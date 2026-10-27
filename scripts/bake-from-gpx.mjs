// Re-bake scenes from GPX files (which carry real elevation) and update
// elevation_gain from the resulting climb.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gpxDir = join(root, 'GPX_OUT');
const outDir = join(root, 'public/scenes');
const cacheDir = process.env.VERT_TILE_CACHE || '/tmp/vert-bake-cache';
const bake = join(root, 'node_modules/@geekplux/vert/dist-lib/bake.js');

const actPath = join(root, 'src/static/activities.json');
const scenesPath = join(root, 'src/static/scenes.json');
const acts = JSON.parse(readFileSync(actPath, 'utf8'));
const byId = new Map(acts.map((a) => [String(a.run_id), a]));
let hashes = existsSync(scenesPath) ? JSON.parse(readFileSync(scenesPath, 'utf8')) : {};

const files = readdirSync(gpxDir).filter((f) => f.endsWith('.gpx'));
console.log(`gpx files: ${files.length}`);
let ok = 0, failed = 0, elev = 0;

for (const f of files) {
  const id = f.replace(/\.gpx$/, '');
  if (!byId.has(id)) { console.log(`skip ${id}: not in activities`); continue; }
  const code = await new Promise((res) => {
    const child = spawn(process.execPath, [bake, join(gpxDir, f), '--id', id, '--out', outDir, '--cache', cacheDir], {
      stdio: ['ignore', 'ignore', 'ignore'],
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    child.on('error', () => res(1));
    child.on('close', res);
  });
  const sidecar = join(outDir, `${id}.scene.json`);
  if (code === 0 && existsSync(sidecar)) {
    const s = JSON.parse(readFileSync(sidecar, 'utf8'));
    hashes[id] = s.hash;
    const a = byId.get(id);
    if (typeof s.summary?.climb === 'number' && s.summary.climb > 0 && s.summary.climb !== a.elevation_gain) {
      a.elevation_gain = s.summary.climb;
      elev++;
    }
    ok++;
  } else failed++;
  if ((ok + failed) % 10 === 0) console.log(`progress ${ok + failed}/${files.length} (ok ${ok}, elev ${elev})`);
}

writeFileSync(actPath, JSON.stringify(acts));
const sorted = Object.fromEntries(Object.keys(hashes).sort().map((k) => [k, hashes[k]]));
writeFileSync(scenesPath, JSON.stringify(sorted, null, 2) + '\n');
console.log(`done: ok ${ok}, failed ${failed}, elevation updated ${elev}`);
