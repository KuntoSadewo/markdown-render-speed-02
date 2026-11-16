// FastMark driver: reads cases.json, renders each case with parse(),
// writes html.json. Node 22, erasable TypeScript only, built-in
// modules only. Deterministic: no wall clock, no env as a source of
// variation, no reads outside the bot/input/output/tmp dirs.
// The harness tells the bot where those dirs are through MAKEFUN_*_DIR
// (the process driver uses temp dirs; the container mounts /input and
// /output); fall back to the container paths when unset.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

type Case = { id: string; markdown: string };

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const cases: Case[] = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8'));
const html: string[] = new Array(cases.length);
for (let i = 0; i < cases.length; i++) {
  html[i] = parse(cases[i].markdown);
}
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'html.json'), JSON.stringify(html));
