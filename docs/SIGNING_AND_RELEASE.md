# Signing And Release Strategy

Aura Desktop has two build modes.

## Local Internal Build

Command:

```powershell
npm run dist
```

Purpose:

- internal development;
- local QA;
- verifying Electron packaging;
- verifying installer behavior before a signed release.

This mode creates:

```text
apps/desktop/release/Aura-Setup-0.1.0.exe
```

Local builds are not suitable for public distribution because they are unsigned.

## Development GitHub Release

During active development, unsigned builds can be published to GitHub Releases so installed dev builds can update without manual reinstalling.

Use SemVer prerelease versions for frequent alpha builds:

```text
0.1.1-alpha.1
0.1.1-alpha.2
0.1.1-alpha.3
```

Do not use versions such as `0.1.01` for updater releases. Electron Builder and update tooling normalize SemVer numeric identifiers, so `0.1.01` becomes `0.1.1`.

Command:

```powershell
npm --workspace @aura/desktop run dist:dev-release
```

GitHub Actions runs this path automatically when no signing certificate secrets are configured.

This is only for development. Production releases should use signed builds.

## Production Release Build

Command:

```powershell
$env:AURA_RELEASE_SIGNING="true"
$env:AURA_UPDATE_PROVIDER="github"
$env:AURA_GITHUB_OWNER="twohemp-design"
$env:AURA_GITHUB_REPO="aura-desktop"
$env:CSC_LINK="path-or-base64-pfx"
$env:CSC_KEY_PASSWORD="certificate-password"
npm run dist:release
```

Required:

- Windows code-signing certificate;
- private certificate password stored outside the repository;
- public GitHub Releases or another public update hosting endpoint;
- release artifact storage;
- version bump before publishing.

Production builds:

- use Electron Builder's signing/editing pipeline;
- generate NSIS installer;
- generate update metadata;
- publish to the configured GitHub Releases or generic update provider when publishing is enabled.

## GitHub Releases

The default production update provider is GitHub Releases:

```text
owner: twohemp-design
repo: aura-desktop
```

Installed apps can check GitHub Releases without a bundled token only when the release feed is publicly reachable.

If the source repository must stay private, use one of these approaches:

- publish updates to a separate public releases-only repository;
- publish updates to `https://updates.aurahub.ru`;
- proxy private release assets through a backend that does not expose GitHub tokens to the desktop app.

## Add GitHub Signing Secrets

When you have a `.pfx` certificate file and its password, run:

```powershell
.\scripts\set-github-signing-secrets.ps1 `
  -CertificatePath "C:\path\to\certificate.pfx" `
  -CertificatePassword "certificate-password"
```

This stores:

- `CSC_LINK`: base64-encoded `.pfx`;
- `CSC_KEY_PASSWORD`: certificate password.

Never commit the `.pfx` file or password to the repository.

## Update Channel Model

Planned channels:

- `stable`: public release;
- `beta`: early testers;
- `dev`: internal desktop QA.

Recommended URLs:

```text
https://updates.aurahub.ru/desktop/win/stable
https://updates.aurahub.ru/desktop/win/beta
https://updates.aurahub.ru/desktop/win/dev
```

The app currently checks updates manually through the desktop bridge. Automatic rollout policy should be added only after signed releases and update hosting are verified.

## Security Rules

Never commit:

- `.pfx` files;
- certificate passwords;
- signing tokens;
- update server credentials.

The release machine or CI must inject secrets through environment variables.
