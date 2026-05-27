const { spawnSync } = require('node:child_process');
const { readdirSync, statSync } = require('node:fs');
const { join, extname } = require('node:path');

const ROOTS = ['server.js', 'src'];

function walk(path, files = []) {
  const st = statSync(path);
  if (st.isFile()) {
    if (extname(path) === '.js') files.push(path);
    return files;
  }

  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules') continue;
    walk(join(path, entry), files);
  }

  return files;
}

const files = ROOTS.flatMap((p) => walk(p));
let hasErrors = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) hasErrors = true;
}

if (hasErrors) {
  process.exit(1);
}

console.log(`Lint sintáctico OK en ${files.length} archivos JS.`);
