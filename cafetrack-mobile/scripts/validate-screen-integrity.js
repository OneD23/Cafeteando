const fs = require('fs');
const path = require('path');

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relPath) {
  const full = path.join(__dirname, '..', relPath);
  return fs.readFileSync(full, 'utf8');
}

function main() {
  const pos = read('src/screens/POSScreen.tsx');
  const login = read('src/screens/LoginScreen.tsx');

  // POS must not embed Login screen declarations.
  assert(!pos.includes('const LoginScreen'), 'POSScreen contiene código de LoginScreen (const LoginScreen).');
  assert(!pos.includes('bootstrapForm'), 'POSScreen contiene estado de bootstrap/login por conflicto.');
  assert(!pos.includes('export default LoginScreen'), 'POSScreen contiene export default LoginScreen por conflicto.');

  // Login bootstrap handler should only exist once.
  const duplicateLegacy = countOccurrences(login, 'const handleBootstrapAdmin = async () => {');
  assert(duplicateLegacy <= 1, `LoginScreen tiene handleBootstrapAdmin duplicado (${duplicateLegacy}).`);

  const duplicateCurrent = countOccurrences(login, 'const onBootstrapAdmin = async () => {');
  assert(duplicateCurrent <= 1, `LoginScreen tiene onBootstrapAdmin duplicado (${duplicateCurrent}).`);

  console.log('Screen integrity checks passed.');
}

try {
  main();
} catch (error) {
  console.error(`Screen integrity check failed: ${error.message}`);
  process.exit(1);
}
