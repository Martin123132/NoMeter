# Contributing

NoMeter is built for practical local-first utility: no uploads, no accounts, no credits, no limits.

## Ground Rules

- Keep file processing local by default.
- Do not add telemetry, remote processing, or account flows without a clear opt-in design.
- Do not introduce fixed-drive assumptions. Paths must be configurable and should work from different installation locations.
- Prefer existing engines over custom parsers for complex formats.
- Keep subscriptions out of the core project.

## Development Loop

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run build
npm.cmd run native:doctor
```

For UI changes, also run the app and exercise:

- Samples -> Run image batch.
- Samples -> Merge PDFs.
- Samples -> Split PDFs.
- Mobile viewport smoke check.

## Native Engine Guidelines

Native engine adapters should:

- Build commands from structured arguments, not interpolated shell strings.
- Use allowlisted engine IDs.
- Keep temporary and output paths off the system drive by default when the host filesystem allows it.
- Clean up temporary files after each job.
- Report progress in the common job model.

## Pull Requests

Keep PRs small and focused. A good PR includes:

- User-facing summary.
- Commands run.
- Before/after screenshots for UI changes.
- Notes about any format or platform limitations.
