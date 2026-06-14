const fs = require("node:fs");
const path = require("node:path");

function createTemporaryPath(targetPath) {
  const suffix = `${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;

  return path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${suffix}.tmp`
  );
}

function atomicWriteFile(targetPath, content, { force = false } = {}) {
  const targetExists = fs.existsSync(targetPath);

  if (targetExists && !force) {
    throw new Error(
      `Le fichier existe déjà : ${targetPath}. Utilise --force pour le remplacer.`
    );
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = createTemporaryPath(targetPath);

  try {
    fs.writeFileSync(temporaryPath, content, {
      encoding: "utf8",
      flag: "wx",
    });
    fs.renameSync(temporaryPath, targetPath);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }

    throw error;
  }

  return targetPath;
}

module.exports = {
  atomicWriteFile,
  createTemporaryPath,
};
