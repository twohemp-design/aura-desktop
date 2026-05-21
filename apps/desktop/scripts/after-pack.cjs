const path = require("node:path");
const { rcedit } = require("rcedit");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const exePath = path.join(context.appOutDir, "Aura.exe");
  const iconPath = path.join(context.packager.projectDir, "assets", "aura-icon.ico");

  await rcedit(exePath, {
    icon: iconPath,
    "version-string": {
      CompanyName: "Aura",
      FileDescription: "Aura Desktop",
      ProductName: "Aura",
      InternalName: "Aura",
      OriginalFilename: "Aura.exe",
    },
  });
};
