import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

// Dependency-free import graph check. Run after moving a feature module or
// before shipping a large refactor; does not replace a Vite production build.
const srcRoot = resolve(import.meta.dirname, '../src');
const files = [];
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = join(dir, entry.name);
    if (entry.isDirectory()) visit(target);
    else if (/\.(?:js|jsx|mjs|css)$/.test(entry.name)) files.push(target);
  }
}
visit(srcRoot);
const extensions = ['', '.js', '.jsx', '.mjs', '.css', '.json', '.svg', '.png', '/index.js', '/index.jsx'];
const errors = [];
let links = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  // Covers static imports, `import('...')`, `new URL('./worker', import.meta.url)`.
  const moduleRefs = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*|\bnew\s+URL\s*\(\s*)(['"])(\.{1,2}\/[^'"\n]+)\1/gm;
  const cssRefs = /(?:@import\s+|url\(\s*)(['"]?)(\.{1,2}\/[^'"\n)]+)\1/gm;
  for (const rx of extname(file)==='.css'?[cssRefs]:[moduleRefs]) {
    for (const match of text.matchAll(rx)) {
      const ref = match[2].split('?')[0].split('#')[0];
      const target = resolve(dirname(file), ref);
      const resolved = extensions.some(ext => {
        const candidate = target + ext;
        return existsSync(candidate) && statSync(candidate).isFile();
      });
      links++;
      if (!resolved) errors.push(`${file.slice(srcRoot.length+1)} -> ${match[2]}`);
    }
  }
}
if (errors.length) {
  console.error(`Unresolved local imports (${errors.length}):\n${errors.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Source import graph OK: ${files.length} files and ${links} relative references.`);
}
