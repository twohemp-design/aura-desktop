const releaseSigning = process.env.AURA_RELEASE_SIGNING === "true";
const updateUrl = process.env.AURA_UPDATE_URL || "";
const updateProvider = process.env.AURA_UPDATE_PROVIDER || (updateUrl ? "generic" : "github");
const githubOwner = process.env.AURA_GITHUB_OWNER || "twohemp-design";
const githubRepo = process.env.AURA_GITHUB_REPO || "aura-desktop";
const githubReleaseType = process.env.AURA_GITHUB_RELEASE_TYPE || "prerelease";

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "ru.aurahub.desktop",
  productName: "Aura",
  electronVersion: "42.2.0",
  afterPack: releaseSigning ? undefined : "scripts/after-pack.cjs",
  directories: {
    output: "release",
  },
  files: [
    "dist/**/*",
    "assets/**/*",
    "package.json",
  ],
  extraResources: [
    {
      from: "assets",
      to: "assets",
    },
  ],
  icon: "assets/aura-icon.ico",
  publish: updateProvider === "github"
    ? [
        {
          provider: "github",
          owner: githubOwner,
          repo: githubRepo,
          releaseType: githubReleaseType,
        },
      ]
    : updateUrl
      ? [
          {
            provider: "generic",
            url: updateUrl,
          },
        ]
      : null,
  win: {
    signAndEditExecutable: releaseSigning,
    icon: "assets/aura-icon.ico",
    protocols: [
      {
        name: "Aura",
        schemes: ["aura"],
      },
    ],
    target: ["nsis"],
    artifactName: "Aura-Setup-${version}.${ext}",
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
};
