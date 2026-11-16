# FastMark

A dependency-free Markdown renderer in a single ES module (`parse.js`),
byte-identical to [marked](https://github.com/markedjs/marked) 18.1.3
(default options: GFM on, breaks off) on the CommonMark 0.31.2 + GFM 0.29
spec examples and long README documents — and several times faster, using a
single-pass hand-written scanner instead of regex-heavy tokenizing.

[![markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/c/markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/KuntoSadewo/markdown-render-speed-02/rank.svg)](https://make.fun/c/markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/KuntoSadewo/markdown-render-speed-02/reward.svg)](https://make.fun/c/markdown-render-speed-02)

## Usage

```js
import { parse } from './parse.js';
parse('# Hello\n\nSome *text*.');
// '<h1>Hello</h1>\n<p>Some <em>text</em>.</p>\n'
```

## Files

- `parse.js` — the renderer. `export function parse(markdown)` (also the
  default export). Stateless, no dependencies, no I/O.
- `main.ts` — the harness driver: reads `/input/cases.json`, writes
  `/output/html.json`. Node 22, built-in modules only.
- `LICENSE` — MIT.

## Entry

Built for the make.fun bounty
[markdown-render-speed-02](https://make.fun/c/markdown-render-speed-02).
