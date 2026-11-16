import { readFileSync as readText, writeFileSync as writeText, mkdirSync as makeDir } from 'node:fs';
import { join as joinPath } from 'node:path';
import { parse as renderMarkdown } from './parse.js';

const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const inputText = readText(joinPath(inDir, 'cases.json'), 'utf8');
const cases = JSON.parse(inputText);
makeDir(outDir, { recursive: true });
const rendered = cases.map((item) => renderMarkdown(item.markdown));
writeText(joinPath(outDir, 'html.json'), JSON.stringify(rendered));
