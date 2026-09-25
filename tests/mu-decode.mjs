#!/usr/bin/env node
/* tests/mu-decode.mjs — cdp-run çıktısındaki base64 görüntüleri PNG dosyalarına yazar.
   Kullanım: node tests/mu-decode.mjs out.json tests/mu-shots   (result.shots / result.*.shots okunur) */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [src, dir = 'tests/mu-shots'] = process.argv.slice(2);
const raw = readFileSync(src, 'utf8');
const json = JSON.parse(raw.slice(raw.indexOf('{')));
const shots = (json.result && json.result.shots) || {};
mkdirSync(dir, { recursive: true });
const written = [];
for (const [name, url] of Object.entries(shots)) {
  const m = /^data:image\/png;base64,(.*)$/.exec(String(url));
  if (!m) continue;
  const file = join(dir, name + '.png');
  writeFileSync(file, Buffer.from(m[1], 'base64'));
  written.push(file);
}
const rest = { ...json, result: { ...json.result, shots: Object.keys(shots) } };
console.log(JSON.stringify({ written, run: rest }, null, 2));
