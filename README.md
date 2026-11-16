# FastMark

A single-file Markdown renderer (`parse.js`) with no dependencies. It
produces exactly the HTML that marked 18.1.3 produces with its default
settings, on the CommonMark 0.31.2 and GFM 0.29 example sets and on long
README-style documents — while running several times faster than marked,
thanks to a hand-written single-pass scanner instead of regex tokenizing.

[![FastMark on make.fun](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/c/markdown-render-speed-02)
[![FastMark rank](https://make.fun/badge/markdown-render-speed-02/KuntoSadewo/markdown-render-speed-02/rank.svg)](https://make.fun/c/markdown-render-speed-02)
[![FastMark reward](https://make.fun/badge/markdown-render-speed-02/KuntoSadewo/markdown-render-speed-02/reward.svg)](https://make.fun/c/markdown-render-speed-02)

## How to use

```js
import { parse } from './parse.js';
const out = parse('## Title\n\nA *quick* example.');
// '<h2>Title</h2>\n<p>A <em>quick</em> example.</p>\n'
```

## What is in this repo

- `parse.js` — the renderer itself. It exports `parse(markdown)` (and
  also as the default export). It keeps no state between calls, uses no
  dependencies and does no I/O.
- `main.ts` — the driver the grading harness runs: it reads the cases
  from `/input/cases.json` and writes the rendered HTML to
  `/output/html.json`. Node 22, only built-in modules.
- `LICENSE` — MIT.

## The bounty

This entry was built for the make.fun competition
[markdown-render-speed-02](https://make.fun/c/markdown-render-speed-02).
