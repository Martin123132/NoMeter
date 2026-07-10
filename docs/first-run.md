# First Run Guide

This is the short path for normal Windows users who want to try NoMeter without reading the release engineering docs.

## Download

1. Open the latest GitHub release.
2. Download `NoMeter_<version>_x64-portable.exe`.
3. Download `checksums.sha256`.
4. Put both files in the same folder.

## Verify

Compare the SHA-256 hash before running the app:

```powershell
Get-FileHash .\NoMeter_<version>_x64-portable.exe -Algorithm SHA256
```

The hash should match the matching line in `checksums.sha256`.

## Launch

Double-click the portable `.exe`. NoMeter does not require an account, upload files, or use conversion credits.

If Windows warns about an unsigned app, stop and verify the hash again. The current public trust model is documented in [Windows trust posture](windows-trust.md).

## Try The Sample Mission

1. Leave `Guided` mode on.
2. Click `Try sample files`.
3. Follow the highlighted route: Source, Recipe, Run, Export.
4. Click `Run conversion`.
5. Open the result from the Exports panel.

The sample mission uses generated demo files. It is safe to run and does not include private material.

## Use Your Own Files

For browser-ready jobs, use image, ZIP, PDF merge, or PDF split tools. These run locally in the app.

For desktop-native jobs, use the Native pack section to set:

- Work folder
- Save folder

Use a data-drive folder where possible. The app blocks system-drive native folders by default and keeps the D-drive defaults unless you choose another non-system folder.

## Find Outputs

Browser workflows create downloadable rows in the Exports panel.

Desktop-native workflows also copy results into the configured Save folder and show the saved path in the Exports panel.

The History section keeps output names, actions, sizes, dates, and saved desktop paths in the local app profile. It does not store source files or their contents. Use the retry icon beside a failed queue item to run it again during the same session.

## Keep Work Files Tidy

NoMeter automatically checks the configured Work folder and removes generated `job-*` directories after 24 hours. Use `Clean now` in Native pack to remove generated job folders immediately. Cleanup requires NoMeter's ownership marker, is restricted to the configured non-system Work folder, and never touches the Save folder.

## OCR Language

When Tesseract is available, NoMeter lists the language data installed on the machine. Image OCR and searchable-PDF OCR use the selected language. Searchable PDFs can keep pages that already contain text or redo an existing OCR layer.
