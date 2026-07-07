const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const outputDir = path.join(projectRoot, 'dist');

if (!fs.existsSync(publicDir)) {
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });

const copyRecursive = (source, destination) => {
  const stats = fs.statSync(source);

  if (stats.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }

  fs.copyFileSync(source, destination);
};

for (const entry of fs.readdirSync(publicDir)) {
  copyRecursive(path.join(publicDir, entry), path.join(outputDir, entry));
}
