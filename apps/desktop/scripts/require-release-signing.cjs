const updateProvider = process.env.AURA_UPDATE_PROVIDER || (process.env.AURA_UPDATE_URL ? "generic" : "github");
const required = [];

if (updateProvider === "generic" && !process.env.AURA_UPDATE_URL) {
  required.push("AURA_UPDATE_URL");
}

if (updateProvider === "github") {
  if (!process.env.AURA_GITHUB_OWNER) {
    required.push("AURA_GITHUB_OWNER");
  }

  if (!process.env.AURA_GITHUB_REPO) {
    required.push("AURA_GITHUB_REPO");
  }
}

const missing = required.filter((key) => !process.env[key]);

if (process.env.AURA_RELEASE_SIGNING !== "true") {
  missing.push("AURA_RELEASE_SIGNING=true");
}

const hasCertificateFile = Boolean(process.env.CSC_LINK && process.env.CSC_KEY_PASSWORD);
const hasWindowsStoreSigning = Boolean(process.env.WIN_CSC_LINK && process.env.WIN_CSC_KEY_PASSWORD);

if (!hasCertificateFile && !hasWindowsStoreSigning) {
  missing.push("CSC_LINK + CSC_KEY_PASSWORD or WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD");
}

if (missing.length > 0) {
  console.error("Release builds require production signing/update configuration:");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}
