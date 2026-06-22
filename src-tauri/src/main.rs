use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
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
    folders: Option<NativeFolders>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocumentConvertRequest {
    file_name: String,
    bytes_base64: String,
    output_format: String,
    folders: Option<NativeFolders>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PdfOptimizeRequest {
    file_name: String,
    bytes_base64: String,
    folders: Option<NativeFolders>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeFolders {
    work_dir: Option<String>,
    output_dir: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeArtifact {
    name: String,
    mime_type: String,
    bytes_base64: String,
    log: String,
    saved_path: Option<String>,
}

#[tauri::command]
async fn transcode_media(app: AppHandle, request: FfmpegTranscodeRequest) -> Result<NativeArtifact, String> {
    let input_bytes = general_purpose::STANDARD
        .decode(request.bytes_base64.as_bytes())
        .map_err(|error| format!("Could not decode media input: {error}"))?;

    if input_bytes.is_empty() {
        return Err("The selected media file was empty.".into());
    }

    let work_dir = openforge_work_dir(request.folders.as_ref())?;
    let output_dir = openforge_output_dir(request.folders.as_ref())?;
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
    let saved_path = persist_output(output_dir, &output_name, &output_bytes)?;

    Ok(NativeArtifact {
        name: output_name,
        mime_type: "video/mp4".into(),
        bytes_base64: general_purpose::STANDARD.encode(output_bytes),
        log,
        saved_path,
    })
}

#[tauri::command]
async fn optimize_pdf(app: AppHandle, request: PdfOptimizeRequest) -> Result<NativeArtifact, String> {
    let input_bytes = general_purpose::STANDARD
        .decode(request.bytes_base64.as_bytes())
        .map_err(|error| format!("Could not decode PDF input: {error}"))?;

    if input_bytes.is_empty() {
        return Err("The selected PDF file was empty.".into());
    }

    let work_dir = openforge_work_dir(request.folders.as_ref())?;
    let output_dir = openforge_output_dir(request.folders.as_ref())?;
    let job_dir = work_dir.join(unique_job_id()?);
    fs::create_dir_all(&job_dir).map_err(|error| format!("Could not create work folder: {error}"))?;

    let stem = safe_stem(&request.file_name);
    let output_name = format!("{stem}-optimized.pdf");
    let input_path = job_dir.join("input.pdf");
    let output_path = job_dir.join(&output_name);

    fs::write(&input_path, input_bytes).map_err(|error| format!("Could not write PDF input: {error}"))?;

    let input_arg = input_path
        .to_str()
        .ok_or_else(|| "Input path contains unsupported characters.".to_string())?;
    let output_arg = output_path
        .to_str()
        .ok_or_else(|| "Output path contains unsupported characters.".to_string())?;

    let output = app
        .shell()
        .sidecar("qpdf")
        .map_err(|error| format!("qpdf sidecar is unavailable: {error}"))?
        .args([
            "--linearize",
            "--object-streams=generate",
            "--compress-streams=y",
            "--recompress-flate",
            "--compression-level=9",
            input_arg,
            output_arg,
        ])
        .output()
        .await
        .map_err(|error| format!("Could not run qpdf: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let log = compact_log(&format!("{stdout}\n{stderr}"));

    if !output.status.success() {
        return Err(format!("qpdf failed with status {:?}: {log}", output.status.code()));
    }

    let output_bytes = fs::read(&output_path).map_err(|error| format!("Could not read qpdf output: {error}"))?;
    let saved_path = persist_output(output_dir, &output_name, &output_bytes)?;

    Ok(NativeArtifact {
        name: output_name,
        mime_type: "application/pdf".into(),
        bytes_base64: general_purpose::STANDARD.encode(output_bytes),
        log,
        saved_path,
    })
}

#[tauri::command]
async fn convert_document(app: AppHandle, request: DocumentConvertRequest) -> Result<NativeArtifact, String> {
    let input_bytes = general_purpose::STANDARD
        .decode(request.bytes_base64.as_bytes())
        .map_err(|error| format!("Could not decode document input: {error}"))?;

    if input_bytes.is_empty() {
        return Err("The selected document file was empty.".into());
    }

    let output_format = sanitize_extension(&request.output_format);
    let config = document_output_config(&output_format)
        .ok_or_else(|| format!("Unsupported document output format: {output_format}"))?;
    let work_dir = openforge_work_dir(request.folders.as_ref())?;
    let output_dir = openforge_output_dir(request.folders.as_ref())?;
    let job_dir = work_dir.join(unique_job_id()?);
    fs::create_dir_all(&job_dir).map_err(|error| format!("Could not create work folder: {error}"))?;

    let stem = safe_stem(&request.file_name);
    let input_extension = safe_extension(&request.file_name).unwrap_or_else(|| "txt".into());
    let output_name = format!("{stem}.{}", config.extension);
    let input_path = job_dir.join(format!("input.{input_extension}"));
    let output_path = job_dir.join(&output_name);

    fs::write(&input_path, input_bytes).map_err(|error| format!("Could not write document input: {error}"))?;

    let input_arg = input_path
        .to_str()
        .ok_or_else(|| "Input path contains unsupported characters.".to_string())?
        .to_string();
    let output_arg = output_path
        .to_str()
        .ok_or_else(|| "Output path contains unsupported characters.".to_string())?
        .to_string();
    let mut args = vec![input_arg, "-o".into(), output_arg];

    if config.standalone {
        args.push("--standalone".into());
    }

    let output = app
        .shell()
        .sidecar("pandoc")
        .map_err(|error| format!("Pandoc sidecar is unavailable: {error}"))?
        .args(args)
        .output()
        .await
        .map_err(|error| format!("Could not run Pandoc: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let log = compact_log(&format!("{stdout}\n{stderr}"));

    if !output.status.success() {
        return Err(format!("Pandoc failed with status {:?}: {log}", output.status.code()));
    }

    let output_bytes = fs::read(&output_path).map_err(|error| format!("Could not read Pandoc output: {error}"))?;
    let saved_path = persist_output(output_dir, &output_name, &output_bytes)?;

    Ok(NativeArtifact {
        name: output_name,
        mime_type: config.mime_type.into(),
        bytes_base64: general_purpose::STANDARD.encode(output_bytes),
        log,
        saved_path,
    })
}

struct DocumentOutputConfig {
    extension: &'static str,
    mime_type: &'static str,
    standalone: bool,
}

fn document_output_config(format: &str) -> Option<DocumentOutputConfig> {
    match format {
        "html" => Some(DocumentOutputConfig {
            extension: "html",
            mime_type: "text/html",
            standalone: true,
        }),
        "docx" => Some(DocumentOutputConfig {
            extension: "docx",
            mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            standalone: false,
        }),
        "md" | "markdown" => Some(DocumentOutputConfig {
            extension: "md",
            mime_type: "text/markdown",
            standalone: false,
        }),
        "epub" => Some(DocumentOutputConfig {
            extension: "epub",
            mime_type: "application/epub+zip",
            standalone: true,
        }),
        _ => None,
    }
}

fn openforge_work_dir(folders: Option<&NativeFolders>) -> Result<PathBuf, String> {
    if let Some(path) = configured_folder(folders.and_then(|value| value.work_dir.as_deref()), "work")? {
        return Ok(path);
    }

    if let Ok(value) = std::env::var("OPENFORGE_WORK_DIR") {
        if let Some(path) = configured_folder(Some(&value), "work")? {
            return Ok(path);
        }
    }

    let d_drive_root = PathBuf::from(r"D:\Codex\OpenForge");
    if d_drive_root.exists() {
        return Ok(d_drive_root.join("work"));
    }

    Ok(std::env::temp_dir().join("openforge-work"))
}

fn openforge_output_dir(folders: Option<&NativeFolders>) -> Result<Option<PathBuf>, String> {
    if let Some(path) = configured_folder(folders.and_then(|value| value.output_dir.as_deref()), "save")? {
        return Ok(Some(path));
    }

    if let Ok(value) = std::env::var("OPENFORGE_OUTPUT_DIR") {
        if let Some(path) = configured_folder(Some(&value), "save")? {
            return Ok(Some(path));
        }
    }

    let d_drive_root = PathBuf::from(r"D:\Codex\OpenForge");
    if d_drive_root.exists() {
        return Ok(Some(d_drive_root.join("outputs").join("converted")));
    }

    Ok(None)
}

fn configured_folder(value: Option<&str>, label: &str) -> Result<Option<PathBuf>, String> {
    let Some(raw_value) = value else {
        return Ok(None);
    };
    let trimmed = raw_value.trim();

    if trimmed.is_empty() {
        return Ok(None);
    }

    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(format!("Use an absolute {label} folder path."));
    }

    if is_system_drive_path(&path) {
        return Err(format!(
            "Choose a non-system {label} folder. This NoMeter workspace stays off C:."
        ));
    }

    Ok(Some(path))
}

#[cfg(windows)]
fn is_system_drive_path(path: &Path) -> bool {
    use std::path::{Component, Prefix};

    matches!(
        path.components().next(),
        Some(Component::Prefix(prefix))
            if matches!(prefix.kind(), Prefix::Disk(drive) | Prefix::VerbatimDisk(drive) if drive.to_ascii_uppercase() == b'C')
    )
}

#[cfg(not(windows))]
fn is_system_drive_path(_path: &Path) -> bool {
    false
}

fn persist_output(output_dir: Option<PathBuf>, output_name: &str, output_bytes: &[u8]) -> Result<Option<String>, String> {
    let Some(output_dir) = output_dir else {
        return Ok(None);
    };

    fs::create_dir_all(&output_dir).map_err(|error| format!("Could not create save folder: {error}"))?;
    let saved_path = unique_output_path(&output_dir, output_name);
    fs::write(&saved_path, output_bytes).map_err(|error| format!("Could not save output copy: {error}"))?;

    Ok(Some(saved_path.to_string_lossy().to_string()))
}

fn unique_output_path(output_dir: &Path, output_name: &str) -> PathBuf {
    let file_name = sanitize_file_name(output_name);
    let path = Path::new(&file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("nometer-output");
    let extension = path.extension().and_then(|value| value.to_str());

    for index in 0..1_000 {
        let candidate_name = if index == 0 {
            file_name.clone()
        } else if let Some(extension) = extension {
            format!("{stem}-{index}.{extension}")
        } else {
            format!("{stem}-{index}")
        };
        let candidate = output_dir.join(candidate_name);

        if !candidate.exists() {
            return candidate;
        }
    }

    output_dir.join(format!("{stem}-{}", unique_job_id().unwrap_or_else(|_| "nometer-output".into())))
}

fn unique_job_id() -> Result<String, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("System clock error: {error}"))?
        .as_nanos();

    Ok(format!("job-{nanos}"))
}

fn safe_stem(file_name: &str) -> String {
    let stem = file_name
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(file_name);
    let sanitized = sanitize_component(stem);

    if sanitized.is_empty() {
        "nometer-media".into()
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

fn sanitize_file_name(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches(&['-', '.'][..])
        .to_string();

    if sanitized.is_empty() {
        "nometer-output".into()
    } else {
        sanitized
    }
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
        .invoke_handler(tauri::generate_handler![
            transcode_media,
            convert_document,
            optimize_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running NoMeter");
}
