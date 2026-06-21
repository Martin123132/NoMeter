use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FfmpegTranscodeRequest {
    file_name: String,
    bytes_base64: String,
    output_extension: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeArtifact {
    name: String,
    mime_type: String,
    bytes_base64: String,
    log: String,
}

#[tauri::command]
async fn transcode_media(app: AppHandle, request: FfmpegTranscodeRequest) -> Result<NativeArtifact, String> {
    let input_bytes = general_purpose::STANDARD
        .decode(request.bytes_base64.as_bytes())
        .map_err(|error| format!("Could not decode media input: {error}"))?;

    if input_bytes.is_empty() {
        return Err("The selected media file was empty.".into());
    }

    let work_dir = openforge_work_dir()?;
    let job_dir = work_dir.join(unique_job_id()?);
    fs::create_dir_all(&job_dir).map_err(|error| format!("Could not create work folder: {error}"))?;

    let stem = safe_stem(&request.file_name);
    let input_extension = safe_extension(&request.file_name).unwrap_or_else(|| "media".into());
    let output_extension = request
        .output_extension
        .as_deref()
        .map(sanitize_extension)
        .filter(|extension| !extension.is_empty())
        .unwrap_or_else(|| "mp4".into());
    let output_name = format!("{stem}.{output_extension}");
    let input_path = job_dir.join(format!("input.{input_extension}"));
    let output_path = job_dir.join(&output_name);

    fs::write(&input_path, input_bytes).map_err(|error| format!("Could not write media input: {error}"))?;

    let input_arg = input_path
        .to_str()
        .ok_or_else(|| "Input path contains unsupported characters.".to_string())?;
    let output_arg = output_path
        .to_str()
        .ok_or_else(|| "Output path contains unsupported characters.".to_string())?;

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|error| format!("FFmpeg sidecar is unavailable: {error}"))?
        .args([
            "-y",
            "-hide_banner",
            "-i",
            input_arg,
            "-map",
            "0:v:0?",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "24",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-movflags",
            "+faststart",
            output_arg,
        ])
        .output()
        .await
        .map_err(|error| format!("Could not run FFmpeg: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let log = compact_log(&format!("{stdout}\n{stderr}"));

    if !output.status.success() {
        return Err(format!("FFmpeg failed with status {:?}: {log}", output.status.code()));
    }

    let output_bytes = fs::read(&output_path).map_err(|error| format!("Could not read FFmpeg output: {error}"))?;

    Ok(NativeArtifact {
        name: output_name,
        mime_type: "video/mp4".into(),
        bytes_base64: general_purpose::STANDARD.encode(output_bytes),
        log,
    })
}

fn openforge_work_dir() -> Result<PathBuf, String> {
    if let Ok(value) = std::env::var("OPENFORGE_WORK_DIR") {
        return Ok(PathBuf::from(value));
    }

    let d_drive_root = PathBuf::from(r"D:\Codex\OpenForge");
    if d_drive_root.exists() {
        return Ok(d_drive_root.join("work"));
    }

    Ok(std::env::temp_dir().join("openforge-work"))
}

fn unique_job_id() -> Result<String, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("System clock error: {error}"))?
        .as_millis();

    Ok(format!("job-{millis}"))
}

fn safe_stem(file_name: &str) -> String {
    let stem = file_name
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(file_name);
    let sanitized = sanitize_component(stem);

    if sanitized.is_empty() {
        "openforge-media".into()
    } else {
        sanitized
    }
}

fn safe_extension(file_name: &str) -> Option<String> {
    file_name
        .rsplit_once('.')
        .map(|(_, extension)| sanitize_extension(extension))
        .filter(|extension| !extension.is_empty())
}

fn sanitize_extension(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .take(12)
        .collect::<String>()
        .to_lowercase()
}

fn sanitize_component(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn compact_log(value: &str) -> String {
    const MAX_LOG_LENGTH: usize = 8_000;
    let trimmed = value.trim();

    if trimmed.chars().count() <= MAX_LOG_LENGTH {
        return trimmed.into();
    }

    trimmed
        .chars()
        .rev()
        .take(MAX_LOG_LENGTH)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![transcode_media])
        .run(tauri::generate_context!())
        .expect("error while running OpenForge");
}
