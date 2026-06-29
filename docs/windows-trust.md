# Windows Trust Posture

NoMeter is source-available and local-first. Current public releases are verified with reproducible release metadata and SHA-256 checksums.

## Current Trust Model

The current Windows portable artifact is not code-signed.

Users should verify:

- the GitHub release tag,
- `checksums.sha256`,
- `release-provenance.txt`,
- and the downloaded artifact hash.

For maintainers, the post-release check is:

```powershell
npm run release:verify-download
```

For users, the direct hash check is:

```powershell
Get-FileHash .\NoMeter_<version>_x64-portable.exe -Algorithm SHA256
```

## Recommendation

Short term:

- Continue shipping the portable executable with checksums and provenance.
- Keep the README verification steps prominent.
- Do not block free personal-use releases on paid signing infrastructure.

Medium term:

- Sign Windows installer artifacts before promoting installers as the default download.
- Keep the portable artifact available for users who prefer a simple executable.
- Document the certificate owner and signing timestamp in release notes once signing exists.

Long term:

- Consider automated signing only after the release process is stable.
- Keep signing credentials outside the repository and outside generated release evidence.
- Treat failed or missing signing as a release-review blocker only when a release is advertised as signed.

## Secret Handling

Never commit:

- certificate files,
- signing passwords,
- API tokens,
- private keys,
- vendor account details,
- local signing logs with private paths.

If signing is added later, the CI/release workflow should consume secrets from the release environment only.
