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
