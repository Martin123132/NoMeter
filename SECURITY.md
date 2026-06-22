# Security Policy

NoMeter handles private local files. Treat privacy and filesystem safety as core product behavior, not polish.

## Reporting

Until a public security contact exists, open a private maintainer thread or issue with:

- Reproduction steps.
- Affected file type.
- Platform and app version.
- Whether the issue can leak, corrupt, delete, or overwrite user files.

## Rules For File Handling

- Never upload files by default.
- Never process files through a remote service without explicit user action.
- Never overwrite originals unless the user has explicitly selected that behavior.
- Prefer output directories chosen by the user.
- Keep work directories configurable.
- Avoid C-drive assumptions on Windows.

## Native Process Safety

Native engines must be called through structured process APIs with allowlisted binaries and arguments. Avoid shell-string execution.
