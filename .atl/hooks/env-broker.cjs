const fs = require('node:fs'); const path = require('node:path');
const keys = process.argv.slice(2); const results = {};
if (keys.length === 0) process.exit(1);
const findEnvFiles = (dir, depth = 0) => {
  let files = []; if (depth > 3) return files;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) { files = files.concat(findEnvFiles(fullPath, depth + 1)); }
      else if (e.name.startsWith('.env')) { files.push(fullPath); }
    }
  } catch (_e) {}
  return files;
};
const envFiles = findEnvFiles(process.cwd());
const envContent = envFiles.map(f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } }).join('\n');
for (const key of keys) {
  const match = envContent.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm'));
  if (match) { results[key] = match[1].replace(/(^['"]|['"]$)/g, '').split('#')[0].trim(); }
  else { results[key] = null; }
}
console.log(JSON.stringify(results));
