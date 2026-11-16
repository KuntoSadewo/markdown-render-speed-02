// FastMark v2 — a dependency-free Markdown renderer whose parse(markdown)
// returns exactly the HTML marked 18.1.3 renders with its default options
// (gfm on, breaks off, pedantic off, async off).
//
// Written from scratch in this session against the CommonMark 0.31.2 /
// GFM 0.29 specifications and the observed behaviour of the reference
// renderer. Architecture: a cursor-driven block lexer (rules tried in
// marked's order, recursing into block quotes and list items) plus a
// single-pass inline scanner with a CommonMark delimiter stack for
// emphasis / strong / strikethrough.
//
// No input is recognised or cached: every case is parsed from the
// markdown string it is given, and no state survives a parse() call
// except the document's own link references and the inLink flag that
// marked itself carries across a document (see inlineHtml).

// ------------------------------------------------------------------
// Character classes and small helpers
// ------------------------------------------------------------------

const ASCII_PUNCT = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

function isSpace(ch) {
  if (ch === undefined) return false;
  const code = ch.charCodeAt(0);
  return code === 32 || code === 9 || code === 10 || code === 13;
}

function isAsciiPunct(ch) {
  return ch !== undefined && ASCII_PUNCT.indexOf(ch) !== -1;
}

const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

function isWordChar(ch) {
  if (ch === undefined) return false;
  return WORD_CHAR_RE.test(ch);
}

// ------------------------------------------------------------------
// Escaping. marked escapes & < > " ' in text, code and attribute
// values. In text (and attribute values) a bare & is left alone when
// it already starts a valid character reference; numeric references
// are decoded to the character they name (0, surrogates and values
// above U+10FFFF become U+FFFD) before the escape runs. Named
// references are never decoded.
// ------------------------------------------------------------------

// Decode &#123; / &#x1F600; numeric character references in a string.
function decodeNumericRefs(s) {
  if (s.indexOf('&#') === -1) return s;
  let result = '';
  let cursor = 0;
  while (cursor < s.length) {
    const amp = s.indexOf('&#', cursor);
    if (amp === -1) {
      result += s.slice(cursor);
      break;
    }
    result += s.slice(cursor, amp);
    let j = amp + 2;
    let hex = false;
    if (s[j] === 'x' || s[j] === 'X') {
      hex = true;
      j++;
    }
    const digitsStart = j;
    if (hex) {
      while (j < s.length && /[0-9A-Fa-f]/.test(s[j])) j++;
    } else {
      while (j < s.length && s[j] >= '0' && s[j] <= '9') j++;
    }
    const digits = s.slice(digitsStart, j);
    const limit = hex ? 6 : 7;
    if (digits.length === 0 || digits.length > limit || s[j] !== ';') {
      result += s.slice(amp, j);
      cursor = j;
      continue;
    }
    let cp = hex ? parseInt(digits, 16) : parseInt(digits, 10);
    if (cp === 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) cp = 0xFFFD;
    result += String.fromCodePoint(cp);
    cursor = j + 1;
  }
  return result;
}

// Strict escape: every & < > " ' becomes an entity.
function esc(s) {
  if (!/[&<>"']/.test(s)) return s;
  let out = '';
  let last = 0;
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    let rep;
    if (ch === '&') rep = '&amp;';
    else if (ch === '<') rep = '&lt;';
    else if (ch === '>') rep = '&gt;';
    else if (ch === '"') rep = '&quot;';
    else if (ch === "'") rep = '&#39;';
    else continue;
    out += s.slice(last, k) + rep;
    last = k + 1;
  }
  return out + s.slice(last);
}

// Is txt[i] === '&' the start of a valid character reference?
// Returns the index just past its ';', or -1.
function refEndAt(txt, i) {
  let j = i + 1;
  if (txt[j] === '#') {
    j++;
    let hex = false;
    if (txt[j] === 'x' || txt[j] === 'X') {
      hex = true;
      j++;
    }
    const start = j;
    if (hex) {
      while (j < txt.length && /[0-9A-Fa-f]/.test(txt[j])) j++;
    } else {
      while (j < txt.length && txt[j] >= '0' && txt[j] <= '9') j++;
    }
    const len = j - start;
    if (len === 0 || len > (hex ? 6 : 7)) return -1;
    return txt[j] === ';' ? j + 1 : -1;
  }
  let w = j;
  while (w < txt.length && /[\w]/.test(txt[w])) w++;
  if (w === j) return -1;
  return txt[w] === ';' ? w + 1 : -1;
}

// Escape, but leave a & alone when it starts a valid character
// reference: &#123; &#x1F600; or &word; (any word, known or not).
function escKeepRefs(s) {
  if (!/[&<>"']/.test(s)) return s;
  let out = '';
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '&') {
      const after = refEndAt(s, i);
      if (after !== -1) {
        i = after;
        continue;
      }
      out += s.slice(start, i) + '&amp;';
      start = i + 1;
      i++;
      continue;
    }
    let rep;
    if (ch === '<') rep = '&lt;';
    else if (ch === '>') rep = '&gt;';
    else if (ch === '"') rep = '&quot;';
    else if (ch === "'") rep = '&#39;';
    else {
      i++;
      continue;
    }
    out += s.slice(start, i) + rep;
    start = i + 1;
    i++;
  }
  return out + s.slice(start);
}

// Render a run of plain text: decode numeric references, then escape
// while keeping valid references intact.
function renderText(s) {
  const decoded = decodeNumericRefs(s);
  return escKeepRefs(decoded);
}

// ------------------------------------------------------------------
// URLs: marked percent-encodes a link destination with encodeURI and
// then escapes it for the attribute; a title is only escaped.
// ------------------------------------------------------------------

function cleanHref(href) {
  let encoded;
  try {
    encoded = encodeURI(href);
    encoded = encoded.replace(/%25/g, '%');
  } catch (err) {
    encoded = href;
  }
  return escKeepRefs(encoded);
}

// Normalise a link label for reference lookup: collapse runs of
// whitespace to one space, trim, case-fold. Unicode case folding
// maps ß (and ẞ, which lowercases to ß) to "ss" — plain
// toLowerCase() leaves ß, so [ẞ] would never match a [SS] def.
function normalizeLabel(label) {
  const collapsed = label.replace(/\s+/g, ' ');
  const folded = collapsed.trim().toLowerCase();
  return folded.replace(/ß/g, 'ss');
}

// ------------------------------------------------------------------
// Extended autolinks (GFM). Preceding-character rule for www.:
// start of text, whitespace, or one of ( * _ ~ . A scheme autolink is
// only http:// https:// ftp:// (case-insensitive) and has no
// preceding-character rule. An email is [mailto:]local@domain.
// ------------------------------------------------------------------

const URL_TRAILING = new Set(['?', '!', '.', ',', ':', ';', '*', '_', '~', "'"]);

// ------------------------------------------------------------------
// Inline parsing, second pass. The scanner below follows the
// reference renderer's token order (escape, tag, link, reference
// link, emphasis, code span, hard break, strikethrough, angle
// autolink, extended autolink, text) and its emphasis algorithm:
// delimiters are matched by scanning a masked copy of the source in
// which code spans, links and tags are blanked out, so a * or _
// inside a code span or a link label can never pair with one outside
// it. The regular expressions are the GFM variants the reference
// uses, with their character classes already substituted.
// ------------------------------------------------------------------

// Unicode punctuation / symbol, whitespace-or-punctuation, and
// neither — the three character classes the flanking rules use.
// The GFM variants exclude ~, which counts as a word character.
const RE_PUNCT = /[\p{P}\p{S}]/u;
const RE_PUNCT_GFM = /(?!~)[\p{P}\p{S}]/u;
const RE_PUNCT_SPACE_GFM = /(?!~)[\s\p{P}\p{S}]/u;
const RE_NOT_PUNCT_SPACE_GFM = /(?:[^\s\p{P}\p{S}]|~)/u;
const RE_OPEN_QUOTE = /[\p{Pi}\p{Ps}"']/u;
// A single character that counts as punctuation-or-space for the
// flanking test, excluding * and _ themselves.
const RE_PUNCTUATION = /^((?![*_])[\s\p{P}\p{S}])/u;
const RE_UNICODE_ALNUM = /[\p{L}\p{N}]/u;

// Emphasis left delimiter: a run of * or _ plus the one character
// after it. Groups: 1 = punctuation after a * run, 2 = other
// non-space character after a * run, 3 = punctuation after a _ run,
// 4 = other non-space character after a _ run. A run at the end of
// the source matches with no following character (all groups empty).
const RE_EM_LDELIM = /(?:\*+(?:((?!\*)(?!~)[\p{P}\p{S}])|([^\s*]))?)|(?:_+(?:((?!_)(?!~)[\p{P}\p{S}])|([^\s_]))?)/yu;

// Emphasis right-delimiter scanners, one per delimiter character.
// Each match is either a run of plain text (no group — skipped) or
// a delimiter run in one of six groups: 1 = punctuation before and
// space or end after (plain closer), 2 = word before and punctuation
// or space or end after (plain closer), 3 = punctuation-or-space
// before and word after (opener only), 4 = space before and
// punctuation after (opener only), 5 = punctuation before and
// after, 6 = word or punctuation before and word after. The first
// alternative skips a __...__ pair when scanning for * closers (and
// the mirror image when scanning for _ closers).
const RE_EM_RDELIM_AST = /^[^_*]*?__[^_*]*?\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?=[\s]|$)|(?:[^\s\p{P}\p{S}]|~)(\*+)(?!\*)(?=(?!~)[\s\p{P}\p{S}]|$)|(?!\*)(?!~)[\s\p{P}\p{S}](\*+)(?=(?:[^\s\p{P}\p{S}]|~))|[\s](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?:[^\s\p{P}\p{S}]|~)(\*+)(?=(?:[^\s\p{P}\p{S}]|~))/gu;
const RE_EM_RDELIM_UND = /^[^_*]*?\*\*[^_*]*?_[^_*]*?(?=\*\*)|[^_]+(?=[^_])|(?!_)[\p{P}\p{S}](_+)(?=[\s]|$)|[^\s\p{P}\p{S}](_+)(?!_)(?=[\s\p{P}\p{S}]|$)|(?!_)[\s\p{P}\p{S}](_+)(?=[^\s\p{P}\p{S}])|[\s](_+)(?!_)(?=[\p{P}\p{S}])|(?!_)[\p{P}\p{S}](_+)(?!_)(?=[\p{P}\p{S}])/gu;

// Strikethrough left delimiter (~~ or ~ plus the following
// character) and its right-delimiter scanner (same six groups).
const RE_DEL_LDELIM = /~~?(?:((?!~)[\p{P}\p{S}])|[^\s~])/yu;
const RE_DEL_RDELIM = /^[^~]+(?=[^~])|(?!~)[\p{P}\p{S}](~~?)(?=[\s]|$)|[^\s\p{P}\p{S}](~~?)(?!~)(?=[\s\p{P}\p{S}]|$)|(?!~)[\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])|[\s](~~?)(?!~)(?=[\p{P}\p{S}])|(?!~)[\p{P}\p{S}](~~?)(?!~)(?=[\p{P}\p{S}])|[^\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])/gu;

// The remaining inline token patterns. All are sticky (y) so they
// anchor at the scan position without slicing the source.
const RE_CODE = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/y;
const RE_BR = /( {2,}|\\)\n(?!\s*$)[ \t]*/y;
const RE_ESCAPE = /\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/y;
const RE_AUTOLINK = /<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s\x00-\x1f<>]*|[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_]))>/y;
// Extended autolink: mailto:/xmpp: address, scheme:// or www. URL,
// or a bare email address. Groups: 1 = scheme or www. prefix,
// 2 = the @ of a bare email.
const RE_EMAIL_PART = '[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\\w-])';
const RE_URL = new RegExp('(?:mailto:' + RE_EMAIL_PART + '|xmpp:' + RE_EMAIL_PART + '(?:\\/[A-Za-z0-9@.]+)?)|((?:[hH][tT][tT][pP][sS]?|[fF][tT][pP]):\\/\\/|www\\.)(?:[a-zA-Z0-9\\-]+\\.?)+[^\\s<]*|[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\\w-])', 'y');
// The backpedal trims an extended autolink: a parenthesised group
// survives only when it closes, trailing punctuation is dropped.
const RE_BACKPEDAL = /(?:[^?!.,:;*_'\"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'\"~)]+(?!$))+/;
// Plain text: one chunk up to the next position where a token could
// start — a special character, a word-boundary _, a scheme or www.,
// a mailto:/xmpp: address, an email-shaped run, or two spaces
// before a newline. The first character may be a backtick or tilde
// run (an unmatched one is literal text).
const RE_TEXT_GFM = /(?:[^a-zA-Z0-9](?=mailto:|xmpp:)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|(?:[hH][tT][tT][pP][sS]?|[fF][tT][pP]):\/\/|(?<![^\s*_~(])www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=mailto:|xmpp:)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-]+@))))/y;


// Link labels and references. A label is a bracketed run that may
// hold nested brackets, escapes and code spans (a code span's
// content holds no backticks and its closer may be any length);
// the double-backtick alternative ``+(?=\]) covers a label that
// ends right after an unmatched `` run. These are the patterns the
// reference composes its link, reference-link and mask searches from.
const RE_BRACKETS_SRC = '\\[(?:\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]';
const RE_LABEL_SRC = '(?:\\[(?:' + RE_BRACKETS_SRC + '|\\\\[\\s\\S]|[^\\[\\]\\\\])*?\\]|\\\\[\\s\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\])|[^\\[\\]\\\\`])*?';
const RE_HREF_SRC = '<(?:\\\\.|[^\\n<>\\\\])+>|[^ \\t\\n\\x00-\\x1f]+|(?=\\))';
const RE_TITLE_SRC = '"(?:\\\\[\\s\\S]|[^"\\\\])*"|\'(?:\\\\[\\s\\S]|[^\'\\\\])*\'|\\((?:\\\\[\\s\\S]|[^)\\\\])*\\)';
// A reference label: any run that is not empty and not just
// whitespace before the closing bracket; a single newline is allowed
// inside it unless the next line is blank.
const RE_REF_SRC = '(?!\\s*\\])(?:\\\\[\\s\\S]|[^\\[\\]\\\\\\n]|\\n(?![ \\t]*\\n))+';
// The mask search uses a looser label (up to 999 repetitions) and a
// reference label capped at 999 characters.
const RE_REF_MASK_SRC = '(?!\\s*\\])(?:\\\\[\\s\\S]|[^\\[\\]\\\\]){1,999}';
const RE_LABEL_MASK_SRC = '(?:[^\\[\\]\\\\`]*(?:\\[(?:' + RE_BRACKETS_SRC + '|\\\\[\\s\\S]|[^\\[\\]\\\\])*?\\]|\\\\[\\s\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\]))){0,999}?[^\\[\\]\\\\`]*?';

// Inline link: [label](destination "title"), destination angle or
// bare. Groups: 1 = label, 2 = destination, 3 = title.
const RE_LINK = new RegExp('!?\\[(' + RE_LABEL_SRC + ')\\]\\([ \\t\\n]*(' + RE_HREF_SRC + ')(?:(?:[ \\t]+(?:\\n[ \\t]*)?|\\n[ \\t]*)(' + RE_TITLE_SRC + '))?[ \\t\\n]*\\)', 'y');
// Full reference link [label][ref] and shortcut / collapsed link
// [label] or [label][].
const RE_REFLINK = new RegExp('!?\\[(' + RE_LABEL_SRC + ')\\]\\[(' + RE_REF_SRC + ')\\]', 'y');
const RE_NOLINK = new RegExp('!?\\[(' + RE_REF_SRC + ')\\](?:\\[\\])?', 'y');
// The mask search for reference links anywhere in a source.
const RE_REFLINK_SEARCH = new RegExp('!?\\[(' + RE_LABEL_MASK_SRC + ')\\]\\[(' + RE_REF_MASK_SRC + ')\\]|!?\\[(' + RE_REF_MASK_SRC + ')\\](?:\\[\\])?(?!\\()', 'g');

// Unescape a backslash before any Unicode punctuation or symbol
// (used on link destinations and titles after they are extracted).
const RE_ANY_PUNCT = /\\([\p{P}\p{S}])/gu;
// Outside code spans, punctuation is what the emphasis mask looks
// for: a code span (group 1 = its backtick run), a bare backtick
// run, or a backslash escape (group 2 = the escaped character).
const RE_ANY_PUNCT_OUTSIDE_CODE = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu;
// The emphasis mask blanks out links, code spans and HTML tags: a
// link's label may hold a code span (group a), a code span's
// backtick run is group b.
const RE_BLOCK_SKIP = /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)|(?<!`)(?<b>`+)[^`]+\k<b>(?!`)|<(?! )[^<>]*?>/g;


// The emphasis mask. Reference links whose label is a defined
// reference are blanked out (a label that itself holds a link is
// masked recursively, reference part first); then every escaped
// punctuation becomes + signs, backticks inside code spans become
// + signs, and every link, code span and HTML tag is replaced by
// [aaa...] of the same length. The masked copy is what the emphasis
// scanner reads, so delimiters inside those constructs never pair
// with delimiters outside them. Length is preserved throughout, so
// an index into the masked copy is an index into the source.
function emStrongMask(src, refs) {
  let out = src;
  if (refs && src.includes('[')) {
    const blankRef = (match) => {
      const o = match.lastIndexOf('[');
      if (!Object.hasOwn(refs, normalizeLabel(match.slice(o + 1, -1)))) return match;
      if (o > 1 && match.charAt(0) !== '!') {
        const label = match.slice(1, o - 1);
        if (linkInText(label, refs)) {
          return '[' + label.replace(RE_REFLINK_SEARCH, blankRef) + ']['
            + 'a'.repeat(match.length - o - 2) + ']';
        }
      }
      return '[' + 'a'.repeat(match.length - 2) + ']';
    };
    out = out.replace(RE_REFLINK_SEARCH, blankRef);
  }
  out = out.replace(RE_ANY_PUNCT_OUTSIDE_CODE, (match, ticks, punct) => {
    if (punct) return '+'.repeat(match.length);
    if (ticks) {
      return ticks + match.slice(ticks.length, -ticks.length).replace(/`/g, '+') + ticks;
    }
    return match;
  });
  out = out.replace(RE_BLOCK_SKIP, (match) => '[' + 'a'.repeat(match.length - 2) + ']');
  return out;
}

// Whether a piece of link-label text holds a link of its own: an
// inline link (not an image) inside a blanked-out construct, or a
// reference link whose reference is defined and whose own label
// holds no link.
function linkInText(text, refs) {
  if (!text.includes('[')) return false;
  for (const m of text.matchAll(RE_BLOCK_SKIP)) {
    RE_LINK.lastIndex = 0;
    if (RE_LINK.test(m[0]) && text.charAt(m.index - 1) !== '!') return true;
  }
  for (const m of text.matchAll(RE_REFLINK_SEARCH)) {
    const s = m[0];
    const r = s.lastIndexOf('[');
    if (s.charAt(0) === '!' || !Object.hasOwn(refs, normalizeLabel(s.slice(r + 1, -1)))) continue;
    if (r > 1 && linkInText(s.slice(1, r - 1), refs)) continue;
    return true;
  }
  return false;
}

// For a masked source, the start index of the last delimiter run
// whose preceding character is not whitespace: the bound that
// stops the emphasis scanners from looking past the last possible
// closer. Runs of * and _ share one table each; ~ has its own.
function closerTable(src) {
  const em = { '*': -1, '_': -1 };
  let del = -1;
  const n = src.length;
  for (let s = 0; s < n; s++) {
    const r = src[s];
    if (r !== '*' && r !== '_' && r !== '~') continue;
    const before = s === 0 ? '\n' : src[s - 1];
    let i = s + 1;
    while (i < n && src[i] === r) i++;
    if (before !== ' ' && before !== '\t' && before !== '\n' && before !== '\r' && before !== '\f') {
      if (r === '~') del = s;
      else em[r] = s;
    }
    s = i - 1;
  }
  return { em, del };
}


// Try emphasis / strong at src[p] (a * or _ run). masked is the
// masked copy of the whole inline source and table its closer
// table; prevChar is the last character of the preceding text token
// ('' when the preceding token was not text). Returns
// {end, type, text} or null. The opener must be left-flanking; the
// scan then walks the masked text with the right-delimiter scanner,
// growing the opener count on nested opener runs, skipping closers
// the rule of three rejects, and pairing only once the accumulated
// opener count is consumed. An odd count of the paired run makes
// <em>, an even count <strong>.
function tryEmStrong(src, p, masked, table, prevChar) {
  const e = src.slice(p);
  RE_EM_LDELIM.lastIndex = 0;
  const s = RE_EM_LDELIM.exec(e);
  if (!s || (!s[1] && !s[2] && !s[3] && !s[4])) return null;
  const r = s[0][0];
  let n = prevChar;
  const sameAsPrev = n === r;
  const i = masked.length - e.length;
  let l = i;
  while (l > 0 && masked[l - 1] === r) l--;
  const beforeRun = [...masked.slice(Math.max(0, l - 2), l)].at(-1) ?? '';
  const beforeIsDelimOrPunct = beforeRun === '*' || beforeRun === '_'
    || !!RE_PUNCTUATION.exec(beforeRun);
  if (l < i) n = beforeRun;
  const prevIsPunct = l < i ? beforeIsDelimOrPunct : !!RE_PUNCTUATION.exec(n);
  if (s[4] && n.match(RE_UNICODE_ALNUM)) return null;
  const afterIsPunct = s[1] || s[3] || '';
  if (!afterIsPunct || !n || prevIsPunct) {
    const k = [...s[0]].length - 1;
    let m = k;
    let skipped = 0;
    const runLen = i - l + k;
    const rightFlankingish = !!beforeRun.trim()
      && (!!afterIsPunct || (r === '*' && !beforeIsDelimOrPunct));
    if (r !== '*' && r !== '_') return null;
    const scanRe = r === '*' ? RE_EM_RDELIM_AST : RE_EM_RDELIM_UND;
    const lastCloser = table.em[r];
    const openerEnd = masked.length - e.length + k;
    if (lastCloser < openerEnd) return null;
    const tail = masked.slice(-1 * e.length + k);
    const bound = lastCloser - openerEnd;
    scanRe.lastIndex = 0;
    let hit;
    while ((hit = scanRe.exec(tail)) !== null && !(hit.index > bound)) {
      const g = hit[1] || hit[2] || hit[3] || hit[4] || hit[5] || hit[6];
      if (!g) continue;
      const b0 = [...g].length;
      if (hit[3] || hit[4]) { m += b0; continue; }
      if (hit[5] || hit[6] || rightFlankingish) {
        if (sameAsPrev && (hit[5] || hit[6])) break;
        if (runLen % 3 && !((runLen + b0) % 3)) { skipped += b0; continue; }
      }
      m -= b0;
      if (m > 0) continue;
      const b = Math.min(b0, b0 + m + skipped);
      const firstLen = [...hit[0]][0].length;
      const raw = e.slice(0, k + hit.index + firstLen + b);
      if (Math.min(k, b) % 2) {
        return { end: p + raw.length, type: 'em', text: raw.slice(1, -1) };
      }
      return { end: p + raw.length, type: 'strong', text: raw.slice(2, -2) };
    }
  }
  return null;
}

// Try strikethrough at src[p] (a run of ~). The closer must have
// exactly the opener's tilde count; nested opener runs grow the
// count to consume, and the same six-group scanner decides which
// runs are closers. Returns {end, type, text} or null.
function tryDel(src, p, masked, table, prevChar) {
  const e = src.slice(p);
  RE_DEL_LDELIM.lastIndex = 0;
  const s = RE_DEL_LDELIM.exec(e);
  if (!s) return null;
  if ((s[1] || '') && prevChar && !RE_PUNCTUATION.exec(prevChar)) return null;
  const o = [...s[0]].length - 1;
  let open = o;
  const lastCloser = table.del;
  const openerEnd = masked.length - e.length + o;
  if (lastCloser < openerEnd) return null;
  const tail = masked.slice(-1 * e.length + o);
  const bound = lastCloser - openerEnd;
  RE_DEL_RDELIM.lastIndex = 0;
  let hit;
  while ((hit = RE_DEL_RDELIM.exec(tail)) !== null && !(hit.index > bound)) {
    const g = hit[1] || hit[2] || hit[3] || hit[4] || hit[5] || hit[6];
    if (!g) continue;
    const l = [...g].length;
    if (l !== o) continue;
    if (hit[3] || hit[4]) { open += l; continue; }
    open -= l;
    if (open > 0) continue;
    const use = Math.min(l, l + open);
    const firstLen = [...hit[0]][0].length;
    const raw = e.slice(0, o + hit.index + firstLen + use);
    return { end: p + raw.length, type: 'del', text: raw.slice(o, -o) };
  }
  return null;
}


// Strip trailing backslashes from s (the reference's L()).
function stripTrailingBackslash(s) {
  let end = s.length;
  while (end > 0 && s[end - 1] === '\\') end--;
  return s.slice(0, end);
}

// Parenthesis balance (the reference's ke()): scan s for the pair
// pair (e.g. "()"), skipping escaped characters. Returns the index
// of the first ) that closes below zero, -2 when opens are left
// unclosed, or -1 when neither character occurs or they balance.
function parenBalance(s, pair) {
  if (s.indexOf(pair[0]) === -1 && s.indexOf(pair[1]) === -1) return -1;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === pair[0]) depth++;
    else if (s[i] === pair[1]) {
      depth--;
      if (depth < 0) return i;
    }
  }
  return depth > 0 ? -2 : -1;
}

// Resolve an inline-link regex match into its destination and
// title, or null when the destination is not a link. An angle
// destination must close with an unescaped >; a bare destination is
// cut at the first ) that would leave the parens unbalanced; a
// closing ) escaped by a backslash rejects the link. The title,
// when present, loses its quotes. Returns the raw length the link
// consumes, so the caller can place its end.
function linkHrefTitle(match, isImage) {
  let raw = match[0];
  let href = match[2];
  let title = match[3] || '';
  const dest = href.trim();
  if (dest.startsWith('<')) {
    if (!dest.endsWith('>')) return null;
    const inner = stripTrailingBackslash(dest.slice(0, -1));
    if ((dest.length - inner.length) % 2 === 0) return null;
  } else {
    const cut = parenBalance(href, '()');
    if (cut === -2) return null;
    if (cut > -1) {
      const h = (isImage ? 5 : 4) + match[1].length + cut;
      href = href.substring(0, cut);
      raw = raw.substring(0, h).trim();
      title = '';
    }
  }
  const body = stripTrailingBackslash(raw.slice(0, -1));
  if ((raw.length - body.length) % 2 === 0) return null;
  let out = href.trim();
  if (out.startsWith('<')) out = out.slice(1, -1);
  title = title ? title.slice(1, -1) : '';
  return {
    rawLen: raw.length,
    href: out ? out.replace(RE_ANY_PUNCT, '$1') : out,
    title: title ? title.replace(RE_ANY_PUNCT, '$1') : title,
  };
}

// Build a link (or image) node from a regex match and its resolved
// destination. The label is unescaped for \[ and \] first, then
// tokenised with inLink set; when a nested non-image link is emitted
// while tokenising the label, the outer link is rejected (null).
// On success the node carries the label's child range.
function makeLink(match, resolved, isImage, st, nodes) {
  const labelText = match[1].replace(/\\([\[\]])/g, '$1');
  const prevInLink = st.inLink;
  const prevEmitted = st.linkEmitted;
  const prevRawBlock = st.inRawBlock;
  st.inLink = true;
  st.linkEmitted = false;
  const sub = scanInline(labelText, st, nodes);
  const nested = st.linkEmitted;
  st.inLink = prevInLink;
  st.linkEmitted = prevEmitted;
  if (nested && !isImage) {
    st.inRawBlock = prevRawBlock;
    return null;
  }
  if (!isImage) st.linkEmitted = true;
  return { href: resolved.href, title: resolved.title || null, first: sub.first, last: sub.last };
}

// Try an inline link or image at src[p]. Returns a descriptor with
// the regex match and the resolved destination, or null. An inline
// source with no ) cannot hold an inline link at all.
function tryLinkAt(src, p, st) {
  if (st.linkParenPossible === false) return null;
  RE_LINK.lastIndex = p;
  const m = RE_LINK.exec(src);
  if (!m) return null;
  const isImage = m[0].charAt(0) === '!';
  const labelStart = p + (isImage ? 2 : 1);
  if (labelHasTagPastEnd(src, labelStart, labelStart + m[1].length)) return null;
  const resolved = linkHrefTitle(m, isImage);
  if (!resolved) return null;
  return { end: p + resolved.rawLen, href: resolved.href, title: resolved.title, match: m, resolved, isImage };
}

// Try a full or shortcut reference link at src[p]. Returns a link
// descriptor like tryLinkAt, or {text: true} when the regex matches
// but the reference is undefined (only the [ or ! is literal text),
// or null when nothing matches.
function tryRefLinkAt(src, p, st) {
  RE_REFLINK.lastIndex = p;
  let m = RE_REFLINK.exec(src);
  let isReflink = true;
  if (!m) {
    RE_NOLINK.lastIndex = p;
    m = RE_NOLINK.exec(src);
    isReflink = false;
  }
  if (!m) return null;
  const isImage = m[0].charAt(0) === '!';
  const labelStart = p + (isImage ? 2 : 1);
  if (labelHasTagPastEnd(src, labelStart, labelStart + m[1].length)) return null;
  const key = normalizeLabel(isReflink ? (m[2] || m[1]) : m[1]);
  const ref = st.refs[key];
  if (!ref) return { text: true, ch: m[0].charAt(0) };
  return {
    end: p + m[0].length, href: ref.href, title: ref.title || null,
    match: m, resolved: { href: ref.href, title: ref.title || null }, isImage,
  };
}


// Try an extended autolink at src[p]: a mailto:/xmpp: address, a
// scheme:// or www. URL, or a bare email. A parenthesised group in
// a URL survives only when it closes; trailing punctuation is
// backpedalled away. Returns {end, href, text} or null. Only
// attempted outside a link (the caller checks st.inLink).
function tryUrlAt(src, p) {
  RE_URL.lastIndex = p;
  const t = RE_URL.exec(src);
  if (!t) return null;
  let text, href;
  if (t[2] === '@') {
    text = t[0];
    href = 'mailto:' + t[0];
  } else {
    let raw = t[0];
    let prev;
    do {
      prev = raw;
      const m = RE_BACKPEDAL.exec(raw);
      raw = m ? m[0] : '';
    } while (prev !== raw);
    text = raw;
    href = t[1] === 'www.' ? 'http://' + raw : raw;
  }
  return { end: p + text.length, href, text };
}

// Try an angle autolink <scheme:...> or <email> at src[p]. The
// scheme needs at least two characters; an email needs a dotted
// domain. Returns {end, href, text} or null.
function tryAngleAutolink(src, p) {
  RE_AUTOLINK.lastIndex = p;
  const t = RE_AUTOLINK.exec(src);
  if (!t) return null;
  const text = t[1];
  const href = t[2] === '@' ? 'mailto:' + text : text;
  return { end: p + t[0].length, href, text };
}

// Try a code span at src[p] (a backtick run closed by a run of the
// same length). Newlines inside become spaces; one leading and one
// trailing space are stripped when the content is not all spaces.
// Returns {end, text} or null.
function tryCodeSpanAt(src, p) {
  RE_CODE.lastIndex = p;
  const t = RE_CODE.exec(src);
  if (!t) return null;
  let text = t[2].replace(/\n/g, ' ');
  if (/[^ ]/.test(text) && text.startsWith(' ') && text.endsWith(' ')) {
    text = text.substring(1, text.length - 1);
  }
  return { end: p + t[0].length, text };
}

// Try a backslash escape at src[p]: a backslash before an ASCII
// punctuation character yields that character as text.
function tryEscapeAt(src, p) {
  RE_ESCAPE.lastIndex = p;
  const t = RE_ESCAPE.exec(src);
  if (!t) return null;
  return { end: p + 2, text: t[1] };
}

// Try a hard break at src[p]: two or more spaces, or a backslash,
// before a newline that is not the last line of the paragraph.
// The spaces or tabs opening the next line are consumed.
function tryBrAt(src, p) {
  RE_BR.lastIndex = p;
  const t = RE_BR.exec(src);
  if (!t) return null;
  return { end: p + t[0].length };
}


// ------------------------------------------------------------------
// Inline parsing. A scan turns the source of one leaf block into a
// doubly linked list of nodes; emphasis is then resolved over that
// list with the CommonMark delimiter-stack algorithm; finally the
// list is rendered. Link text is scanned recursively (with its own
// emphasis pass) so emphasis never crosses a link boundary, matching
// the reference.
// Node types: 0 text, 1 code span, 2 hard break, 3 soft break,
// 4 raw html, 5 link/image, 6 autolink, 7 delimiter, 8 em,
// 9 strong, 10 del.
// ------------------------------------------------------------------


function pushNode(nodes, node) {
  node.next = -1;
  node.prev = -1;
  nodes.push(node);
  return nodes.length - 1;
}

function linkNodes(nodes, a, b) {
  // Link node a before node b in the list (either may be -1).
  if (a !== -1) nodes[a].next = b;
  if (b !== -1) nodes[b].prev = a;
}

// Scan src into nodes (appended to the shared nodes array) and return
// the {first, last} of the scanned range. st carries the document
// state (refs, inLink, inRawBlock, linkEmitted, linkParenPossible).
// Tokens are tried in the reference's order: escape, tag, link,
// reference link, emphasis, code span, hard break, strikethrough,
// angle autolink, extended autolink (outside a link), text. Text
// runs accumulate in runStart and are flushed as one node when a
// token is found. prevChar is the last character of the preceding
// text token ('' when the preceding token was not text); a text
// token ending in _ leaves it unchanged.
function scanInline(src, st, nodes) {
  const n = src.length;
  let first = -1, last = -1;
  const append = (idx) => {
    if (first === -1) first = idx;
    if (last !== -1) linkNodes(nodes, last, idx);
    last = idx;
  };
  const flushText = (end) => {
    if (end > runStart) {
      append(pushNode(nodes, { t: 0, s: src.slice(runStart, end), raw: st.inRawBlock }));
    }
  };
  // The emphasis mask for this inline source, computed once when the
  // source contains a delimiter character; nested scans (link labels,
  // emphasis contents) compute their own.
  let masked = src;
  let table = null;
  if (src.includes('*') || src.includes('_') || src.includes('~')) {
    masked = emStrongMask(src, st.refs);
    table = closerTable(masked);
  }
  // linkParenPossible is document state in the reference: an inline
  // source with no ) cannot hold an inline link. Save and restore
  // it around this scan so nested scans see their own value.
  const savedParen = st.linkParenPossible;
  st.linkParenPossible = savedParen && src.includes(')');
  let p = 0, runStart = 0;
  let prevChar = '';
  let prevWasText = false;
  try {
    while (p < n) {
      if (!prevWasText) prevChar = '';
      prevWasText = false;
      const ch = src[p];
      if (ch === '\\') {
        const esc = tryEscapeAt(src, p);
        if (esc) {
          flushText(p);
          append(pushNode(nodes, { t: 0, s: esc.text }));
          p = esc.end; runStart = p;
          continue;
        }
        const br = tryBrAt(src, p);
        if (br) {
          flushText(p);
          append(pushNode(nodes, { t: 2 }));
          p = br.end; runStart = p;
          continue;
        }
      }
      if (ch === '<') {
        const tag = matchHtmlTag(src, p);
        if (tag) {
          flushText(p);
          append(pushNode(nodes, { t: 4, s: tag.text }));
          if (tag.isAOpen) st.inLink = true;
          else if (tag.isAClose) st.inLink = false;
          if (/^<(pre|code|kbd|script)(\s|>)/i.test(tag.text)) st.inRawBlock = true;
          else if (/^<\/(pre|code|kbd|script)(\s|>)/i.test(tag.text)) st.inRawBlock = false;
          p = tag.end; runStart = p;
          continue;
        }
        const auto = tryAngleAutolink(src, p);
        if (auto) {
          flushText(p);
          append(pushNode(nodes, { t: 6, href: auto.href, text: auto.text }));
          p = auto.end; runStart = p;
          continue;
        }
      }
      if (ch === '[' || (ch === '!' && src[p + 1] === '[')) {
        const linked = tryLinkAt(src, p, st);
        if (linked) {
          flushText(p);
          const beforeLen = nodes.length;
          const made = makeLink(linked.match, linked.resolved, linked.isImage, st, nodes);
          if (made) {
            append(pushNode(nodes, {
              t: 5, href: made.href, title: made.title, img: linked.isImage,
              first: made.first, last: made.last,
            }));
            p = linked.end; runStart = p;
            continue;
          }
          nodes.length = beforeLen;
          runStart = p;
          p = p + 1;
          continue;
        }
        const refl = tryRefLinkAt(src, p, st);
        if (refl) {
          if (refl.text) {
            p = p + 1;
            continue;
          }
          flushText(p);
          const beforeLen = nodes.length;
          const made = makeLink(refl.match, refl.resolved, refl.isImage, st, nodes);
          if (made) {
            append(pushNode(nodes, {
              t: 5, href: made.href, title: made.title, img: refl.isImage,
              first: made.first, last: made.last,
            }));
            p = refl.end; runStart = p;
            continue;
          }
          nodes.length = beforeLen;
          runStart = p;
          p = p + 1;
          continue;
        }
      }
      if ((ch === '*' || ch === '_') && table) {
        const em = tryEmStrong(src, p, masked, table, prevChar);
        if (em) {
          flushText(p);
          const sub = scanInline(em.text, st, nodes);
          append(pushNode(nodes, {
            t: em.type === 'em' ? 8 : 9, first: sub.first, last: sub.last,
          }));
          p = em.end; runStart = p;
          continue;
        }
      }
      if (ch === '`') {
        const code = tryCodeSpanAt(src, p);
        if (code) {
          flushText(p);
          append(pushNode(nodes, { t: 1, s: code.text }));
          p = code.end; runStart = p;
          continue;
        }
      }
      if (ch === ' ') {
        const br = tryBrAt(src, p);
        if (br) {
          flushText(p);
          append(pushNode(nodes, { t: 2 }));
          p = br.end; runStart = p;
          continue;
        }
      }
      if (ch === '~' && table) {
        const del = tryDel(src, p, masked, table, prevChar);
        if (del) {
          flushText(p);
          const sub = scanInline(del.text, st, nodes);
          append(pushNode(nodes, { t: 10, first: sub.first, last: sub.last }));
          p = del.end; runStart = p;
          continue;
        }
      }
      if (!st.inLink) {
        const url = tryUrlAt(src, p);
        if (url) {
          flushText(p);
          append(pushNode(nodes, { t: 6, href: url.href, text: url.text }));
          p = url.end; runStart = p;
          continue;
        }
      }
      // plain text up to the next position where a token could start
      RE_TEXT_GFM.lastIndex = p;
      const tx = RE_TEXT_GFM.exec(src);
      if (tx) {
        const end = p + tx[0].length;
        const lastCh = tx[0].slice(-1);
        if (lastCh !== '_') prevChar = lastCh;
        prevWasText = true;
        p = end;
        continue;
      }
      // The text pattern always matches at least one character; this
      // only guards against an unbounded loop.
      p = p + 1;
    }
  } finally {
    st.linkParenPossible = savedParen;
  }
  flushText(n);
  return { first, last };
}


// Angle-bracket autolink <scheme:...> or <email>. Returns
// {end, href, text} or null.
function matchAngleAutolink(src, i) {
  const n = src.length;
  let j = i + 1;
  // scheme: [A-Za-z][A-Za-z0-9+.-]{1,31}:
  if (j < n && /[A-Za-z]/.test(src[j])) {
    let k = j + 1;
    while (k < n && /[A-Za-z0-9+.-]/.test(src[k])) k++;
    if (k - j >= 2 && k - j <= 32 && src[k] === ':') {
      let e = k + 1;
      while (e < n && src[e] !== '>' && src[e] !== '<' && src[e] !== ' ' && src[e] !== '\n') e++;
      if (e < n && src[e] === '>' && e > k + 1) {
        const text = src.slice(i + 1, e);
        return { end: e + 1, href: text, text };
      }
    }
  }
  // email: local@domain (domain labels, dot optional here)
  let at = -1;
  let e = j;
  while (e < n && src[e] !== '>' && src[e] !== ' ' && src[e] !== '\n' && src[e] !== '<') {
    if (src[e] === '@') at = e;
    e++;
  }
  if (at !== -1 && e < n && src[e] === '>') {
    const local = src.slice(j, at);
    if (/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(local)) {
      const d = scanDomain(src, at + 1);
      if (d && d.end === e) {
        const text = src.slice(i + 1, e);
        return { end: e + 1, href: 'mailto:' + text, text };
      }
    }
  }
  return null;
}

// Match a raw HTML tag at i: comment, processing instruction,
// declaration, CDATA section, or an open/close tag with attributes.
// Returns {end, text, isAOpen, isAClose} or null.
function matchHtmlTag(src, i) {
  const n = src.length;
  const rest = src.slice(i, i + 12);
  if (rest.startsWith('<!--')) {
    // marked's comment regex <!--(?:-?>|[\s\S]*?-->) : a > or ->
    // right after <!-- closes the comment at once (<!--> and
    // <!---> are complete comments); otherwise it runs to -->
    if (src[i + 4] === '>') return { end: i + 5, text: src.slice(i, i + 5), isAOpen: false, isAClose: false };
    if (src[i + 4] === '-' && src[i + 5] === '>') return { end: i + 6, text: src.slice(i, i + 6), isAOpen: false, isAClose: false };
    let e = src.indexOf('-->', i + 4);
    if (e === -1) e = n;
    else e += 3;
    return { end: e, text: src.slice(i, e), isAOpen: false, isAClose: false };
  }
  if (rest.startsWith('<?')) {
    let e = src.indexOf('?>', i + 2);
    if (e === -1) e = n;
    else e += 2;
    return { end: e, text: src.slice(i, e), isAOpen: false, isAClose: false };
  }
  if (rest.startsWith('<!')) {
    if (i + 2 < n && /[A-Za-z]/.test(src[i + 2])) {
      let e = src.indexOf('>', i + 2);
      if (e === -1) return null;
      return { end: e + 1, text: src.slice(i, e + 1), isAOpen: false, isAClose: false };
    }
    if (src.startsWith('<![CDATA[', i)) {
      let e = src.indexOf(']]>', i + 9);
      if (e === -1) e = n;
      else e += 3;
      return { end: e, text: src.slice(i, e), isAOpen: false, isAClose: false };
    }
    return null;
  }
  // open or close tag
  let j = i + 1;
  let closing = false;
  if (src[j] === '/') { closing = true; j++; }
  if (j >= n || !/[A-Za-z]/.test(src[j])) return null;
  const nameStart = j;
  while (j < n && /[A-Za-z0-9-]/.test(src[j])) j++;
  const name = src.slice(nameStart, j).toLowerCase();
  // marked's startATag is /^<a /i: only an <a> tag with a space
  // (attributes) after the name sets inLink; a bare <a> does not
  const afterName = src[j];
  // a close tag takes only whitespace, then > (no attributes)
  if (closing) {
    while (j < n && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n')) j++;
    if (j >= n || src[j] !== '>') return null;
    return { end: j + 1, text: src.slice(i, j + 1), isAOpen: false, isAClose: name === 'a' };
  }
  // attributes until >; each attribute must be preceded by
  // whitespace (marked's attribute pattern starts with \s+) — so
  // <m:abc> is not a tag (no space before :abc) and
  // <a href='bar'title=title> is not one either (no space before
  // the second attribute)
  let sawSpace = false;
  for (;;) {
    if (j >= n) return null;
    const c = src[j];
    if (c === '>') { j++; break; }
    if (c === '/' && src[j + 1] === '>') { j += 2; break; }
    if (c === ' ' || c === '\t' || c === '\n') { j++; sawSpace = true; continue; }
    // attribute name — only after whitespace
    if (!sawSpace) return null;
    if (!/[A-Za-z_:]/.test(c)) return null;
    while (j < n && /[A-Za-z0-9_.:-]/.test(src[j])) j++;
    sawSpace = false;
    // optional = value
    let k = j;
    while (k < n && (src[k] === ' ' || src[k] === '\t' || src[k] === '\n')) k++;
    if (src[k] === '=') {
      k++;
      while (k < n && (src[k] === ' ' || src[k] === '\t' || src[k] === '\n')) k++;
      if (src[k] === '"') {
        k++;
        // marked's inline tag regex allows a newline inside a
        // quoted attribute value ("[^"]*") — <a href="foo\nbar">
        // is a tag; only the block-level condition 7 forbids it
        while (k < n && src[k] !== '"') k++;
        if (k >= n || src[k] !== '"') return null;
        k++;
      } else if (src[k] === "'") {
        k++;
        while (k < n && src[k] !== "'") k++;
        if (k >= n || src[k] !== "'") return null;
        k++;
      } else {
        if (k >= n || /[ \t\n"'=<>`]/.test(src[k])) return null;
        while (k < n && !/[ \t\n"'=<>`]/.test(src[k])) k++;
      }
      j = k;
    } else {
      // no value: the whitespace skipped above separates this
      // attribute from the next one, so it counts as seen
      if (k > j) sawSpace = true;
      j = k;
    }
  }
  return {
    end: j, text: src.slice(i, j),
    isAOpen: !closing && name === 'a' && afterName === ' ',
    isAClose: closing && name === 'a',
  };
}

// If src[i] starts a backtick run, return the index just past the
// matching closing run of the same length (a code span), or null
// when there is no closing run (the backticks are literal text).
// A longer run does not close a shorter one.
function skipCodeSpan(src, i) {
  const n = src.length;
  let k = 0;
  while (src[i + k] === '`') k++;
  if (k === 0) return null;
  let j = i + k;
  while (j < n) {
    if (src[j] === '`') {
      let m = 0;
      while (src[j + m] === '`') m++;
      if (m === k) return j + k;
      j += m;
    } else {
      j++;
    }
  }
  return null;
}

// marked's Be(): a link is rejected when its label contains a <
// that starts an HTML tag or autolink extending past the label's
// end (the tag swallows the ] that would close the label). Code
// spans inside the label are skipped.
function labelHasTagPastEnd(src, labelStart, labelEnd) {
  const n = src.length;
  let s = labelStart;
  while (s < labelEnd) {
    const c = src[s];
    if (c === '\\' && s + 1 < n && isAsciiPunct(src[s + 1])) { s += 2; continue; }
    if (c === '`') {
      const after = skipCodeSpan(src, s);
      if (after !== null) { s = after; continue; }
    }
    if (c !== '<') { s++; continue; }
    const tag = matchHtmlTag(src, s);
    if (tag && tag.end > labelEnd) return true;
    if (tag) { s += Math.max(1, tag.end - s); continue; }
    // angle autolink <scheme:...> or <email>
    const m = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s\x00-\x1f<>]*|[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)>/.exec(src.slice(s, Math.min(n, s + 256)));
    if (m && s + m[0].length > labelEnd) return true;
    if (m) { s += m[0].length; continue; }
    s++;
  }
  return false;
}

// Parse a link (or image) starting at src[i] === '[' (or '![' with
// i at the '!'). Returns {end, href, title, label} or null.
function tryParseLink(src, i, st, isImage) {
  const n = src.length;
  const open = isImage ? i + 1 : i;
  // find the matching ] with balanced brackets, honouring escapes;
  // a ] inside a code span does not close the label
  let depth = 0;
  let j = open;
  while (j < n) {
    const c = src[j];
    if (c === '\\' && j + 1 < n && isAsciiPunct(src[j + 1])) { j += 2; continue; }
    if (c === '`') {
      const after = skipCodeSpan(src, j);
      if (after !== null) { j = after; continue; }
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) break;
    }
    j++;
  }
  if (depth !== 0 || j >= n) return null;
  // a tag/autolink inside the label that runs past the ] rejects
  // the link (marked's Be)
  if (labelHasTagPastEnd(src, open + 1, j)) return null;
  const label = src.slice(open + 1, j);
  let k = j + 1;
  if (src[k] === '(') {
    const tail = parseInlineLinkTail(src, k);
    if (tail) return { end: tail.end, href: tail.href, title: tail.title, label };
    // the inline tail failed (e.g. a destination with spaces):
    // fall through to the shortcut reference below, leaving the
    // (...) as literal text ([foo](not a link) with a [foo] def
    // is a shortcut link + literal tail)
  }
  if (src[k] === '[') {
    // full reference [text][label] or collapsed [text][]
    let d = 0;
    let q = k;
    while (q < n) {
      const c = src[q];
      if (c === '\\' && q + 1 < n && isAsciiPunct(src[q + 1])) { q += 2; continue; }
      if (c === '[') d++;
      else if (c === ']') {
        d--;
        if (d === 0) break;
      }
      q++;
    }
    if (d !== 0 || q >= n) return null;
    const refLabel = src.slice(k + 1, q);
    const key = normalizeLabel(refLabel === '' ? label : refLabel);
    const ref = st.refs[key];
    if (!ref) return null;
    return { end: q + 1, href: ref.href, title: ref.title, label };
  }
  // shortcut reference
  if (label === '') return null;
  const ref = st.refs[normalizeLabel(label)];
  if (!ref) return null;
  return { end: j + 1, href: ref.href, title: ref.title, label };
}

// Parse the (destination "title") tail of an inline link, src[k] === '('.
function parseInlineLinkTail(src, k) {
  const n = src.length;
  let p = skipInlineSpace(src, k + 1);
  if (p === -1) return null;
  let dest;
  if (src[p] === '<') {
    let q = p + 1;
    let ok = false;
    while (q < n) {
      const c = src[q];
      if (c === '\n') return null;
      if (c === '\\' && q + 1 < n && isAsciiPunct(src[q + 1])) { q += 2; continue; }
      if (c === '>') { ok = true; break; }
      if (c === '<') return null;
      q++;
    }
    if (!ok) return null;
    dest = unescapePunct(src.slice(p + 1, q));
    p = q + 1;
  } else {
    let depth = 0;
    let q = p;
    while (q < n) {
      const c = src[q];
      if (c === ' ' || c === '\t' || c === '\n' || c.charCodeAt(0) < 32) break;
      if (c === '\\' && q + 1 < n && isAsciiPunct(src[q + 1])) { q += 2; continue; }
      if (c === '(') depth++;
      else if (c === ')') {
        if (depth === 0) break;
        depth--;
      }
      q++;
    }
    // an empty destination is a valid link ([link]() -> href "")
    dest = unescapePunct(src.slice(p, q));
    p = q;
  }
  p = skipInlineSpace(src, p);
  if (p === -1) return null;
  let title = null;
  if (src[p] === '"' || src[p] === "'" || src[p] === '(') {
    const t = parseLinkTitle(src, p);
    if (!t) return null;
    title = t.title;
    p = skipInlineSpace(src, t.end);
    if (p === -1) return null;
  }
  if (src[p] !== ')') return null;
  return { end: p + 1, href: dest, title };
}

// Skip spaces, tabs and single newlines; return -1 on a blank line
// or end of input.
function skipInlineSpace(src, p) {
  const n = src.length;
  let seenNewline = false;
  while (p < n) {
    const c = src[p];
    if (c === ' ' || c === '\t') { p++; continue; }
    if (c === '\n') {
      if (seenNewline) return -1;
      seenNewline = true;
      p++;
      continue;
    }
    break;
  }
  return p < n ? p : -1;
}

// Parse a link title at src[p] ('"' or "'" or '('). Returns
// {end, title} or null.
function parseLinkTitle(src, p) {
  const n = src.length;
  const q0 = src[p];
  if (q0 !== '"' && q0 !== "'" && q0 !== '(') return null;
  const closer = q0 === '(' ? ')' : q0;
  let q = p + 1;
  while (q < n) {
    const c = src[q];
    if (c === '\\' && q + 1 < n && isAsciiPunct(src[q + 1])) { q += 2; continue; }
    if (c === closer) {
      return { end: q + 1, title: unescapePunct(src.slice(p + 1, q)) };
    }
    if (c === '\n') {
      if (q0 === "'") {
        // a single line ending is allowed in '...' titles, unless
        // the next line is blank
        let r = q + 1;
        while (r < n && (src[r] === ' ' || src[r] === '\t')) r++;
        if (r >= n || src[r] === '\n') return null;
        q++;
        continue;
      }
      return null;
    }
    if (q0 === '(' && (c === '(' || c === ')')) return null;
    q++;
  }
  return null;
}

// Remove backslash escapes before ASCII punctuation in s.
function unescapePunct(s) {
  if (s.indexOf('\\') === -1) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length && isAsciiPunct(s[i + 1])) { out += s[i + 1]; i++; }
    else out += s[i];
  }
  return out;
}

// ------------------------------------------------------------------
// Emphasis: the CommonMark delimiter-stack algorithm over the
// node list. A delimiter trapped inside a formed em/strong/del is
// dead and renders literally.
// ------------------------------------------------------------------

function processEmphasis(nodes, first, last) {
  let head = first, tail = last;
  if (first === -1) return { first, last };
  const delims = [];
  for (let i = first; i !== -1; i = nodes[i].next) {
    if (nodes[i].t === 7) delims.push(i);
    if (i === last) break;
  }
  if (delims.length === 0) return { first, last };
  let cur = 0;
  while (cur < delims.length) {
    const cIdx = delims[cur];
    const C = nodes[cIdx];
    if (C.dead || C.n === 0 || !C.close) { cur++; continue; }
    // look back for the nearest usable opener
    let found = -1;
    for (let j = cur - 1; j >= 0; j--) {
      const oIdx = delims[j];
      const O = nodes[oIdx];
      if (O.dead || O.n === 0 || !O.open || O.ch !== C.ch) continue;
      // del: marked's regex backreferences the opening run, so the
      // opener must have the same tilde count as the closer; a
      // mismatched opener is skipped, not a match
      if (C.ch === '~' && O.n !== C.n) continue;
      // odd-match rule (CommonMark rule 9): if ONE of the two
      // delimiters can both open and close emphasis, the sum of
      // their lengths must not be a multiple of 3 unless both are.
      // This is judged per (opener, closer) pair: an opener that
      // is an odd match for one closer (different length) may
      // still match a later closer, so no persistent bottom is kept
      if (((O.open && O.close) || (C.open && C.close))
        && (O.n + C.n) % 3 === 0 && (O.n % 3 !== 0 || C.n % 3 !== 0)) {
        continue;
      }
      found = j;
      break;
    }
    if (found === -1) { cur++; continue; }
    const oIdx = delims[found];
    const O = nodes[oIdx];
    let use = 1;
    if (C.ch === '~') use = O.n;
    else if (O.n >= 2 && C.n >= 2) use = 2;
    // create the wrapper node; its children are the nodes between O and C
    const wIdx = nodes.length;
    const W = {
      t: C.ch === '~' ? 10 : (use === 2 ? 9 : 8),
      next: -1, prev: -1, first: O.next, last: C.prev,
    };
    nodes.push(W);
    // delimiters between O and C are trapped: dead, literal text
    for (let i = O.next; i !== -1 && i !== cIdx; i = nodes[i].next) {
      if (nodes[i].t === 7) nodes[i].dead = true;
    }
    O.n -= use;
    C.n -= use;
    if (O.n === 0) {
      O.dead = true;
      if (O.prev !== -1) nodes[O.prev].next = wIdx;
      else if (head === oIdx) head = wIdx;
      W.prev = O.prev;
    } else {
      if (C.ch === '~' && O.n < 2) O.dead = true;
      O.next = wIdx;
      W.prev = oIdx;
    }
    if (C.n === 0) {
      C.dead = true;
      if (C.next !== -1) nodes[C.next].prev = wIdx;
      else if (tail === cIdx) tail = wIdx;
      W.next = C.next;
    } else {
      if (C.ch === '~' && C.n < 2) C.dead = true;
      C.prev = wIdx;
      W.next = cIdx;
    }
    if (C.n > 0 && !C.dead) continue; // same closer may match again
    cur++;
  }
  return { first: head, last: tail };
}

// ------------------------------------------------------------------
// Rendering a node list to HTML.
// ------------------------------------------------------------------

function renderNodes(nodes, first, last) {
  let out = '';
  for (let i = first; i !== -1; i = nodes[i].next) {
    out += renderNode(nodes, nodes[i]);
    if (i === last) break;
  }
  return out;
}

function renderNode(nodes, nd) {
  switch (nd.t) {
    case 0: return renderText(nd.s);
    case 1: return '<code>' + esc(nd.s) + '</code>';
    case 2: return '<br>';
    case 3: return '\n';
    case 4: return nd.s;
    case 5: {
      const href = cleanHref(nd.href);
      const title = nd.title !== null && nd.title !== undefined
        ? ' title="' + escKeepRefs(nd.title) + '"' : '';
      if (nd.img) {
        return '<img src="' + href + '" alt="' + plainText(nodes, nd.first, nd.last) + '"' + title + '>';
      }
      return '<a href="' + href + '"' + title + '>'
        + renderNodes(nodes, nd.first, nd.last) + '</a>';
    }
    case 6: return '<a href="' + cleanHref(nd.href) + '">' + renderText(nd.text) + '</a>';
    case 7: return nd.dead || nd.n === 0 ? nd.ch.repeat(nd.n) : nd.ch.repeat(nd.n);
    case 8: return '<em>' + renderNodes(nodes, nd.first, nd.last) + '</em>';
    case 9: return '<strong>' + renderNodes(nodes, nd.first, nd.last) + '</strong>';
    case 10: return '<del>' + renderNodes(nodes, nd.first, nd.last) + '</del>';
    default: return '';
  }
}

// Plain text of a node list (for image alt text): formatting is
// stripped, text is rendered as text, code as escaped code.
function plainText(nodes, first, last) {
  if (first === -1) return '';
  let out = '';
  for (let i = first; i !== -1; i = nodes[i].next) {
    const nd = nodes[i];
    switch (nd.t) {
      case 0: out += renderText(nd.s); break;
      case 1: out += esc(nd.s); break;
      case 2: out += '<br>'; break;
      case 3: out += '\n'; break;
      case 4: break;
      case 5: out += plainText(nodes, nd.first, nd.last); break;
      case 6: out += renderText(nd.text); break;
      case 7: out += nd.ch.repeat(nd.n); break;
      case 8: case 9: case 10: out += plainText(nodes, nd.first, nd.last); break;
      default: break;
    }
    if (i === last) break;
  }
  return out;
}

// Parse one leaf block's inline content to HTML. st is the document
// state; its inLink flag persists across blocks (marked behaviour).
function inlineHtml(src, st) {
  const nodes = [];
  const range = scanInline(src, st, nodes, false);
  const proc = processEmphasis(nodes, range.first, range.last);
  return renderNodes(nodes, proc.first, proc.last);
}

// ------------------------------------------------------------------
// Block lexer
// ------------------------------------------------------------------

// index of the newline ending the line that starts at pos (or n)
function lineEnd(txt, off) {
  const nl = txt.indexOf('\n', off);
  return nl < 0 ? txt.length : nl;
}

// leading whitespace of the line starting at pos: columns (tab stops
// every 4) and the index of the first non-space/tab character
function indentOf(txt, off) {
  let cols = 0;
  let cur = off;
  for (;;) {
    const ch = txt[cur];
    if (ch === ' ') {
      cols += 1;
      cur += 1;
    } else if (ch === '\t') {
      cols += 4 - (cols % 4);
      cur += 1;
    } else {
      break;
    }
  }
  return { cols, next: cur };
}

// remove up to n columns of leading whitespace from a line; a tab
// that straddles the cut becomes spaces for the remainder
function dedentCols(line, n) {
  let taken = 0;
  let idx = 0;
  for (; idx < line.length && taken < n; idx++) {
    const ch = line[idx];
    if (ch !== ' ' && ch !== '\t') break;
    if (ch === ' ') {
      taken += 1;
      continue;
    }
    const span = 4 - (taken % 4);
    if (taken + span > n) {
      return ' '.repeat(taken + span - n) + line.slice(idx + 1);
    }
    taken += span;
  }
  return line.slice(idx);
}

function isBlankLine(txt, off) {
  const end = lineEnd(txt, off);
  let blank = true;
  for (let cur = off; cur < end && blank; cur++) {
    const ch = txt[cur];
    if (ch !== ' ' && ch !== '\t') blank = false;
  }
  return blank;
}

// a line that can start a fresh block (used to stop paragraphs and
// table bodies); defs are NOT in this set — marked leaves a def line
// inside a paragraph as literal text
function startsBlock(txt, off) {
  const ind = indentOf(txt, off);
  if (ind.cols > 3) return false;
  const le = lineEnd(txt, off);
  const c = txt[ind.next];
  if (c === '#') {
    const head = txt.slice(ind.next, le);
    if (/^#{1,6}(?:[ \t]|$)/.test(head)) return true;
  }
  if (c === '`' || c === '~') {
    let run = 0;
    while (txt[ind.next + run] === c) run++;
    if (run < 3) {
      // not a fence; fall through to the list/html checks
    } else if (c === '`' && txt.slice(ind.next + run, le).indexOf('`') !== -1) {
      return false;
    } else {
      return true;
    }
  }
  if (c === '>') return true;
  if (c === '-' || c === '*' || c === '_') {
    if (isHrLine(txt, off)) return true;
  }
  // a list interrupts a paragraph only when its first item is
  // non-empty, and (for an ordered list) starts at 1
  const li = listStartInfo(txt, off);
  if (li !== null && li.empty === false && (li.ordered === false || li.start === 1)) return true;
  return htmlBlockStartInterrupt(txt, off) >= 0;
}

// HTML block condition (1-6) that can interrupt a paragraph, a
// table body or a lazy list line — marked's paragraph/table/list
// html pattern: condition 1 is OPEN tags only (<pre etc., NOT
// </pre>), condition 6 is open or close tags, conditions 2-5 as
// usual; condition 7 never interrupts
const SCRIPT_STYLE_OPEN = /^<(?:script|pre|style|textarea)(?:[\s/>]|$)/i;
const BLOCK_TAG_RE = /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[\s/>]|$)/i;

function htmlBlockStartInterrupt(txt, off) {
  const ind = indentOf(txt, off);
  if (ind.cols > 3) return -1;
  const rest = txt.slice(ind.next, lineEnd(txt, off));
  if (SCRIPT_STYLE_OPEN.test(rest)) return 1;
  if (rest.startsWith('<!--')) return 2;
  if (rest.startsWith('<?')) return 3;
  if (rest.length >= 3 && rest[0] === '<' && rest[1] === '!' && /[A-Za-z]/.test(rest[2])) return 4;
  if (rest.startsWith('<![CDATA[')) return 5;
  if (BLOCK_TAG_RE.test(rest)) return 6;
  return -1;
}

function isHrLine(txt, off) {
  const ind = indentOf(txt, off);
  const le = lineEnd(txt, off);
  const c = txt[ind.next];
  let count = 0;
  let clean = ind.cols <= 3 && (c === '-' || c === '*' || c === '_');
  for (let i = ind.next; i < le && clean; i++) {
    const ch = txt[i];
    if (ch === c) count += 1;
    else if (ch === ' ' || ch === '\t') continue;
    else clean = false;
  }
  return clean && count >= 3;
}

// fenced code block; returns {block, next} or null
function tryFences(txt, off) {
  const ind = indentOf(txt, off);
  if (ind.cols > 3) return null;
  const le = lineEnd(txt, off);
  const fenceCh = txt[ind.next];
  if (fenceCh !== '`' && fenceCh !== '~') return null;
  let runLen = 0;
  while (txt[ind.next + runLen] === fenceCh) runLen++;
  if (runLen < 3) return null;
  const info = txt.slice(ind.next + runLen, le);
  if (fenceCh === '`' && info.indexOf('`') !== -1) return null;
  const total = txt.length;
  let scan = le + 1;
  const bodyStart = scan;
  let closeAt = -1;
  while (scan < total) {
    const lineStop = lineEnd(txt, scan);
    const lineInd = indentOf(txt, scan);
    if (lineInd.cols <= 3 && txt[lineInd.next] === fenceCh) {
      let run2 = 0;
      while (txt[lineInd.next + run2] === fenceCh) run2++;
      if (run2 >= runLen) {
        let onlyWs = true;
        for (let j = lineInd.next + run2; j < lineStop; j++) {
          if (txt[j] !== ' ' && txt[j] !== '\t') {
            onlyWs = false;
            break;
          }
        }
        if (onlyWs) {
          closeAt = scan;
          break;
        }
      }
    }
    scan = lineStop + 1;
  }
  const bodyEnd = closeAt < 0 ? total : closeAt;
  const raw = txt.slice(bodyStart, bodyEnd);
  const rawLines = raw.split('\n');
  // marked's fences regex consumes the newline immediately before
  // the closing fence as a separator, so the content never carries
  // a trailing newline of its own (the renderer adds one back)
  if (raw.length > 0 && raw.endsWith('\n')) rawLines.pop();
  // marked's Dt(): indent compensation applies only to backtick
  // fences (indentCodeCompensation is /^(\s+)(?:```)/); a tilde
  // fence keeps every content line byte-for-byte. The strip is in
  // CHARACTERS, not columns: each line loses min(its own leading
  // whitespace length, the fence line's leading whitespace length)
  // — so a tab is removed whole, not converted to spaces.
  const fenceWsLen = ind.next - off;
  let text;
  if (fenceCh === '~') {
    text = rawLines.join('\n');
  } else {
    const stripped = [];
    for (const ln of rawLines) {
      const ws = ln.match(/^\s+/);
      stripped.push(ws ? ln.slice(Math.min(ws[0].length, fenceWsLen)) : ln);
    }
    text = stripped.join('\n');
  }
  const langRaw = info.trim().split(/\s+/)[0] || '';
  const next = closeAt < 0 ? total : lineEnd(txt, closeAt) + 1;
  return {
    block: { type: 'code', text, lang: unescapePunct(langRaw), fenced: true },
    next,
  };
}

// ATX heading; returns {block, next} or null
function tryHeading(txt, off) {
  const ind = indentOf(txt, off);
  if (ind.cols > 3) return null;
  let hashes = 0;
  while (txt[ind.next + hashes] === '#') hashes++;
  if (hashes === 0 || hashes > 6) return null;
  const le = lineEnd(txt, off);
  const after = txt[ind.next + hashes];
  const afterOk = after === undefined || after === ' ' || after === '\t' || after === '\n';
  if (!afterOk) return null;
  let text = txt.slice(ind.next + hashes, le);
  text = text.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
  // strip a closing sequence of #s: marked strips the trailing #s
  // when what remains is empty or ends with a space/tab (so a
  // heading whose whole content is #s becomes empty)
  if (text.endsWith('#')) {
    const stripped = text.replace(/#+$/, '');
    if (stripped === '' || /[ \t]$/.test(stripped)) {
      text = stripped.replace(/[ \t]+$/, '');
    }
  }
  return { block: { type: 'heading', level: hashes, text }, next: le + 1 };
}

// indented code block (4+ spaces); returns {block, next} or null
function tryIndentedCode(txt, off) {
  const ind = indentOf(txt, off);
  if (ind.cols < 4) return null;
  const total = txt.length;
  const outLines = [];
  let scan = off;
  let endsWithNL = false;
  while (scan < total) {
    const le = lineEnd(txt, scan);
    if (isBlankLine(txt, scan)) {
      // a whitespace-only line inside the code is dedented like
      // any other line (marked's codeRemoveIndent), so 6 spaces
      // become 2, not an empty line; it belongs to the code only
      // if a code line follows
      let probe = le + 1;
      let codeFollows = false;
      while (probe < total) {
        if (isBlankLine(txt, probe)) {
          probe = lineEnd(txt, probe) + 1;
          continue;
        }
        codeFollows = indentOf(txt, probe).cols >= 4;
        break;
      }
      if (!codeFollows) break;
      outLines.push(dedentCols(txt.slice(scan, le), 4));
      scan = le + 1;
      continue;
    }
    if (indentOf(txt, scan).cols < 4) break;
    outLines.push(dedentCols(txt.slice(scan, le), 4));
    scan = le + 1;
    endsWithNL = scan <= total && (scan === total || txt[scan - 1] === '\n');
  }
  // drop trailing blank lines (they are not part of the code)
  while (outLines.length > 0 && outLines[outLines.length - 1].trim() === '') outLines.pop();
  if (outLines.length === 0) return null;
  return {
    block: { type: 'code', text: outLines.join('\n') + (endsWithNL ? '\n' : ''), lang: '' },
    next: scan,
  };
}

// HTML block start condition (1-7); -1 means no HTML block here.
// Returns the condition number; the caller decides the end rule.
function htmlBlockStart(txt, off) {
  const ind = indentOf(txt, off);
  if (ind.cols > 3) return -1;
  const rest = txt.slice(ind.next, lineEnd(txt, off));
  // type 1 is an OPENING <pre>/<script>/<style>/<textarea> only;
  // a closing </pre> is a type-7 block (marked's Ue type-1
  // alternative has no /? after <)
  if (SCRIPT_STYLE_OPEN.test(rest)) return 1;
  if (rest.startsWith('<!--')) return 2;
  if (rest.startsWith('<?')) return 3;
  if (rest.length >= 3 && rest[0] === '<' && rest[1] === '!' && /[A-Za-z]/.test(rest[2])) return 4;
  if (rest.startsWith('<![CDATA[')) return 5;
  if (BLOCK_TAG_RE.test(rest)) return 6;
  // condition 7: a complete open/close tag (not a void element) alone
  // on the line, with valid attributes (marked's Ue attribute
  // pattern: each attribute needs a leading space, a name, and an
  // optional quoted/unquoted value) — so <a h*#ref="hi"> and
  // <a href='bar'title=title> are paragraphs, not html blocks
  const attrPat = ' +[a-zA-Z:_][\\w.:-]*(?: *= *"[^"\\n]*"| *= *\'[^\'\\n]*\'| *= *[^\\s"\'=<>`]+)?';
  const open7 = new RegExp('^<[A-Za-z][A-Za-z0-9-]*(?:' + attrPat + ')*? */?>[ \\t]*$', 'i').test(rest);
  const close7 = /^<\/[A-Za-z][A-Za-z0-9-]*\s*>[ \t]*$/.test(rest);
  if (open7 || close7) return 7;
  return -1;
}

// HTML block; returns {block, next} or null
function tryHtmlBlock(txt, off) {
  const cond = htmlBlockStart(txt, off);
  if (cond < 0) return null;
  const total = txt.length;
  const firstLine = txt.slice(off, lineEnd(txt, off));
  let closeRe = null;
  if (cond === 1) {
    const m = /^<\/?(script|pre|style|textarea)/i.exec(firstLine);
    const tagName = m ? m[1] : 'script';
    closeRe = new RegExp('</' + tagName + '\\s*>', 'i');
  }
  const endRes = { 2: /-->/, 3: /\?>/, 4: />/, 5: /\]\]>/ };
  let scan = off;
  let end = total;
  while (scan < total) {
    const le = lineEnd(txt, scan);
    const line = txt.slice(scan, le);
    if (cond === 1) {
      if (closeRe.test(line)) {
        end = le + 1;
        break;
      }
    } else if (cond >= 2 && cond <= 5) {
      if (endRes[cond].test(line)) {
        end = le + 1;
        break;
      }
    } else if (isBlankLine(txt, scan)) {
      end = scan;
      break;
    }
    scan = le + 1;
  }
  if (scan >= total && end === total) end = total;
  // The block regex's closer alternatives end in \n* / \n+ (types
  // 1-5), so the match swallows the empty lines that follow the
  // closing line; types 6-7 end in (?:(?:\n[ \t]*)+\n|$) and swallow
  // every following blank line, spaces-only ones included. ge()
  // then trims them back. (A spaces-only line is not swallowed by
  // types 1-5: \n* stops at the space.)
  if (cond >= 1 && cond <= 5) {
    while (end < total && txt[end] === '\n') end++;
  } else if (cond >= 6) {
    while (end < total && isBlankLine(txt, end)) end = lineEnd(txt, end) + 1;
  }
  // marked's ge(): trim only when the match itself ends in more
  // than one blank line; a single trailing newline (or a blank line
  // after the block) is kept. The block ends where the trimmed
  // text ends, so the blank lines are re-lexed as a newline token.
  let text = txt.slice(off, end);
  const parts = text.split('\n');
  let t = parts.length - 1;
  for (; t >= 0 && /^[ \t]*$/.test(parts[t]);) t--;
  if (parts.length - t > 2) text = parts.slice(0, t + 1).join('\n');
  return { block: { type: 'html', text }, next: off + text.length };
}

// Expand the tabs in a whitespace-only string to spaces, tab stops
// every 4, starting at column startCol (marked's J helper).
function expandWS(s, startCol) {
  let cols = startCol, out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\t') {
      const w = 4 - (cols % 4);
      out += ' '.repeat(w);
      cols += w;
    } else {
      out += s[i];
      cols++;
    }
  }
  return out;
}

// Expand the leading whitespace run of a line to spaces (tab-stop
// aware); the rest of the line is untouched.
function expandLeadingWS(line, startCol) {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
  if (i === 0) return line;
  return expandWS(line.slice(0, i), startCol) + line.slice(i);
}

// Column (tab-stop aware) of the first non-space/tab character.
function firstNonSpaceCol(line) {
  let cols = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === ' ') cols++;
    else if (c === '\t') cols += 4 - (cols % 4);
    else return cols;
  }
  return cols;
}

// Link reference definition at a block position. Returns the parsed
// definition {label, href, title, raw, next} or null; the caller
// decides whether to record it (a def right after a paragraph or a
// list-item text line is literal text instead).
function tryDef(src, pos) {
  const ind = indentOf(src, pos);
  if (ind.cols > 3) return null;
  let p = ind.next;
  if (src[p] !== '[') return null;
  const n = src.length;
  let depth = 0, q = p;
  let label = '';
  while (q < n) {
    const ch = src[q];
    // an escaped punctuation does not open/close the bracket, but
    // the backslash STAYS in the label (marked stores the raw label
    // and only normalises case/whitespace) so the lookup key matches
    if (ch === '\\' && q + 1 < n && isAsciiPunct(src[q + 1])) { label += src[q] + src[q + 1]; q += 2; continue; }
    // a def label may not contain an unescaped [ (marked's def
    // regex); [ref[bar]]: /uri is not a definition
    if (ch === '[' && depth >= 1) return null;
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) break;
    }
    label += ch;
    q++;
  }
  if (q >= n || depth !== 0) return null;
  label = normalizeLabel(label.slice(1));
  if (!label || label.length > 999) return null;
  q++;
  let nl = 0;
  while (q < n && (src[q] === ' ' || src[q] === '\t' || src[q] === '\n')) {
    if (src[q] === '\n') { nl++; if (nl > 3) return null; }
    q++;
  }
  if (src[q] !== ':') return null;
  q++;
  // after the colon: spaces, then optionally one newline plus
  // indentation — the destination may be on the next line
  while (q < n && (src[q] === ' ' || src[q] === '\t')) q++;
  if (src[q] === '\n') {
    q++;
    while (q < n && (src[q] === ' ' || src[q] === '\t')) q++;
    if (q >= n || src[q] === '\n') return null;
  }
  let dest = '';
  if (src[q] === '<') {
    const end = src.indexOf('>', q + 1);
    const le = lineEnd(src, q);
    if (end === -1 || end > le) return null;
    dest = src.slice(q + 1, end);
    if (/[\n<>]/.test(dest)) return null;
    q = end + 1;
  } else {
    const start = q;
    let parens = 0;
    while (q < n) {
      const ch = src[q];
      if (ch === ' ' || ch === '\t' || ch === '\n') break;
      if (ch === '\\' && q + 1 < n && isAsciiPunct(src[q + 1])) { q += 2; continue; }
      if (ch === '(') parens++;
      else if (ch === ')') {
        if (parens === 0) break;
        parens--;
      }
      q++;
    }
    if (q === start) return null;
    dest = src.slice(start, q);
  }
  let title = undefined;
  let r = q;
  let sp = 0;
  while (r < n && (src[r] === ' ' || src[r] === '\t')) { r++; sp++; }
  if (src[r] === '\n') {
    // the title may be on the next line, after its indentation
    let tp = r + 1;
    while (tp < n && (src[tp] === ' ' || src[tp] === '\t')) tp++;
    const t = parseLinkTitle(src, tp);
    if (t) {
      let after = t.end;
      while (after < n && (src[after] === ' ' || src[after] === '\t')) after++;
      if (after < n && src[after] === '\n') { title = t.title; r = after; }
      else if (after >= n) { title = t.title; r = after; }
    }
    // no title: the def ends at this newline
  } else if (sp > 0) {
    // same-line title: needs at least one space before it
    const t = parseLinkTitle(src, r);
    if (t) {
      let after = t.end;
      while (after < n && (src[after] === ' ' || src[after] === '\t')) after++;
      if (after < n && src[after] === '\n') { title = t.title; r = after; }
      else if (after >= n) { title = t.title; r = after; }
    }
  }
  // without a space or newline before it there is no title, and
  // anything else after the destination invalidates the def
  if (r < n && src[r] !== '\n') return null;
  const next = r < n ? r + 1 : n;
  return { label, href: unescapePunct(dest), title, raw: src.slice(pos, r), next };
}

// Strip one blockquote marker from a line: the whitespace after the
// > is expanded starting at the marker's column, then the marker and
// one following space are removed.
function stripQuoteLine(line) {
  const m = /^( {0,3}>)([ \t]+)?(.*)$/.exec(line);
  if (!m) return line;
  const expanded = expandWS(m[2] || '', m[1].length);
  const after = m[1] + expanded + m[3];
  return after.replace(/^ {0,3}>[ \t]?/, '');
}

// The innermost last paragraph/text block of a block list,
// descending into nested blockquotes and list items. Lazy
// continuation lines belong to the deepest paragraph, not to the
// outer quote or list.
function innermostPara(blocks) {
  if (!blocks || !blocks.length) return null;
  let b = blocks[blocks.length - 1];
  while (b) {
    if (b.type === 'para' || b.type === 'text') return b;
    if (b.type === 'quote' && b.blocks && b.blocks.length) {
      b = b.blocks[b.blocks.length - 1];
      continue;
    }
    if (b.type === 'list' && b.items && b.items.length) {
      const it = b.items[b.items.length - 1];
      if (it.blocks && it.blocks.length) {
        b = it.blocks[it.blocks.length - 1];
        continue;
      }
    }
    return null;
  }
  return null;
}

// blockquote; returns {block, next} or null. Processed in chunks like
// marked: each chunk is lazy lines (only after a paragraph chunk)
// followed by > lines; a chunk that ends in a code block, heading,
// hr, HTML block or table stops the quote.
function tryBlockquote(src, pos, st) {
  const ind = indentOf(src, pos);
  if (ind.cols > 3 || src[ind.next] !== '>') return null;
  const n = src.length;
  let p = pos;
  let blocks = [];
  let firstChunk = true;
  // a quote whose content is only a link definition still exists
  // (marked emits an empty blockquote); track marker lines seen
  let sawAny = false;
  // a chunk that ends with a blank line (a bare > marker) closes
  // the paragraph: no lazy continuation may follow it
  let prevChunkEndedBlank = false;
  while (p < n) {
    const chunkLines = [];
    let q = p;
    // a lazy line continues the innermost paragraph (which may sit
    // inside a nested quote); a chunk that ended with a blank line
    // closes the paragraph
    const lastIsPara = !prevChunkEndedBlank && !!innermostPara(blocks);
    // lazy lines (only after the first chunk, only after a paragraph)
    if (!firstChunk && lastIsPara) {
      while (q < n) {
        const le = lineEnd(src, q);
        if (isBlankLine(src, q)) break;
        const lind = indentOf(src, q);
        if (lind.cols <= 3 && src[lind.next] === '>') break;
        if (startsBlock(src, q)) break;
        let line = src.slice(q, le);
        // a lazy setext underline becomes indented text, not a heading
        if (/^ {0,3}(?:=+|-+)[ \t]*$/.test(line)) line = '    ' + line.replace(/^ {0,3}/, '');
        chunkLines.push(line);
        q = le + 1;
      }
    }
    // > lines; a truly blank line ends the blockquote (marked's
    // blockquote block regex requires every line to start with >,
    // so a blank line is never inside one token — a `>` line that
    // looks blank is a marker line, handled above)
    let sawMarker = false;
    while (q < n) {
      const le = lineEnd(src, q);
      const lind = indentOf(src, q);
      if (!isBlankLine(src, q) && lind.cols <= 3 && src[lind.next] === '>') {
        sawMarker = true;
        chunkLines.push(stripQuoteLine(src.slice(q, le)));
        q = le + 1;
        continue;
      }
      break;
    }
    // no chunk formed: a lazy continuation line for the innermost
    // paragraph (inside a nested quote) is appended directly;
    // never after a chunk that ended with a blank line
    if (chunkLines.length === 0 && !firstChunk && !prevChunkEndedBlank) {
      const inner = innermostPara(blocks);
      if (inner) {
        const le = lineEnd(src, q);
        if (q < n && !isBlankLine(src, q)) {
          const lind = indentOf(src, q);
          if (!(lind.cols <= 3 && src[lind.next] === '>')
            && !startsBlock(src, q)) {
            const line = src.slice(q, le);
            inner.text += '\n'
              + (lind.cols >= 4 ? dedentCols(line, 4) : line);
            p = le + 1;
            prevChunkEndedBlank = false;
            continue;
          }
        }
      }
    }
    if (chunkLines.length === 0) break;
    // a chunk of only lazy lines (no > line) is the trailing
    // continuation of a paragraph; anything else needs a marker
    if (!sawMarker && (firstChunk || !lastIsPara)) break;
    sawAny = sawAny || sawMarker;
    // did this chunk end with a blank line (a bare > marker)?
    // (save the previous chunk's value first: it guards the merge)
    const prevEndedBlank = prevChunkEndedBlank;
    prevChunkEndedBlank = chunkLines.length > 0
      && chunkLines[chunkLines.length - 1].trim() === '';
    const sub = chunkLines.join('\n');
    const chunkBlocks = lexBlocks(sub, st, true);
    // a paragraph that spans chunks is one paragraph; an indented
    // code block at the start of a chunk merges into the preceding
    // paragraph (its dedented text appended after a newline); a
    // paragraph (or single-paragraph quote) at the start of a chunk
    // after a nested quote or list is a lazy continuation of its
    // innermost paragraph (a > line never continues a plain para).
    // At most two merges per chunk: a leading paragraph, then a
    // following single-paragraph nested quote that continues the
    // same paragraph (a second paragraph after a blank line inside
    // the chunk must stay separate).
    if (blocks.length > 0 && chunkBlocks.length > 0 && !prevEndedBlank) {
      const last = blocks[blocks.length - 1];
      const inner = innermostPara([last]);
      if (inner) {
        const first = chunkBlocks[0];
        if (first.type === 'para' || first.type === 'text'
          || (first.type === 'code' && !first.fenced)) {
          inner.text += '\n' + first.text;
          chunkBlocks.shift();
        }
        const next = chunkBlocks[0];
        if (next && next.type === 'quote'
          && (last.type === 'quote' || last.type === 'list')
          && next.blocks.length >= 1
          && (next.blocks[0].type === 'para' || next.blocks[0].type === 'text')) {
          inner.text += '\n' + next.blocks[0].text;
          // the rest of the new quote's blocks belong to the same
          // quote: append them to the old quote's blocks (only
          // when the old block is itself a quote with a blocks array)
          if (last.type === 'quote') last.blocks.push(...next.blocks.slice(1));
          chunkBlocks.shift();
        }
      }
    }
    blocks = blocks.concat(chunkBlocks);
    p = q;
    firstChunk = false;
    const last = blocks[blocks.length - 1];
    if (last && (last.type === 'code' || last.type === 'heading'
      || last.type === 'hr' || last.type === 'html' || last.type === 'table')) break;
  }
  if (!sawAny) return null;
  return {
    block: { type: 'quote', blocks, endedBlank: prevChunkEndedBlank },
    next: p,
  };
}

// info about a list item marker at a line start, or null
function listStartInfo(src, pos) {
  const ind = indentOf(src, pos);
  if (ind.cols > 3) return null;
  const le = lineEnd(src, pos);
  const c = src[ind.next];
  let ordered = false, delim = '', start = 1, bw = 1;
  if (c === '*' || c === '+' || c === '-') {
    delim = c;
  } else if (c >= '0' && c <= '9') {
    let q = ind.next;
    while (src[q] >= '0' && src[q] <= '9') q++;
    if (q - ind.next > 9) return null;
    const sep = src[q];
    if (sep !== '.' && sep !== ')') return null;
    delim = sep;
    start = parseInt(src.slice(ind.next, q), 10);
    bw = q + 1 - ind.next;
    ordered = true;
  } else return null;
  const q = ind.next + bw;
  if (q >= le) {
    return {
      ordered, delim, start, bw, bulletCol: ind.cols,
      contentStart: q, empty: true,
    };
  }
  const ch = src[q];
  if (ch !== ' ' && ch !== '\t') return null;
  return {
    ordered, delim, start, bw, bulletCol: ind.cols,
    contentStart: q, empty: false,
  };
}

// does the raw line f start a block within the list-item indent
// (the list-item continuation test: fences, ATX heading, HTML block,
// blockquote, next bullet, hr)? marked clamps the allowed indent to
// min(3, R-1): a marker must start strictly before the content
// indent, so a bullet at exactly the content indent is content.
function listLineStartsBlock(f, R) {
  const maxSp = Math.max(0, Math.min(3, R - 1));
  let sp = 0;
  while (sp < f.length && f[sp] === ' ') sp++;
  if (sp > maxSp) return false;
  const c = f[sp];
  if (c === undefined) return false;
  if (c === '`' || c === '~') {
    let k = 0;
    while (f[sp + k] === c) k++;
    if (k < 3) return false;
    if (c === '`' && f.slice(sp + k).includes('`')) return false;
    return true;
  }
  if (c === '#') {
    let k = 0;
    while (f[sp + k] === '#') k++;
    if (k < 1 || k > 6) return false;
    const a = f[sp + k];
    return a === undefined || a === ' ' || a === '\t';
  }
  if (c === '>') return true;
  if (c === '-' || c === '*' || c === '_') {
    // thematic break?
    let i = sp, count = 0;
    let ok = true;
    while (i < f.length) {
      if (f[i] === c) { count++; i++; }
      else if (f[i] === ' ' || f[i] === '\t') i++;
      else { ok = false; break; }
    }
    if (ok && count >= 3) return true;
    // bullet (not _)
    if (c !== '_') {
      const nx = f[sp + 1];
      if (nx === ' ' || nx === '\t' || nx === undefined) return true;
    }
    return false;
  }
  if (c === '+') {
    const nx = f[sp + 1];
    return nx === ' ' || nx === '\t' || nx === undefined;
  }
  if (c >= '0' && c <= '9') {
    let q = sp;
    while (f[q] >= '0' && f[q] <= '9') q++;
    if (q - sp > 9) return false;
    const sep = f[q];
    if (sep !== '.' && sep !== ')') return false;
    const nx = f[q + 1];
    return nx === ' ' || nx === '\t' || nx === undefined;
  }
  if (c === '<') return htmlBlockStartAt(f, R);
  return false;
}

// does a previous item line's content start a fence, ATX heading,
// HTML block or hr (the lazy-continuation blockers; blockquote and
// bullet lines do NOT block a lazy line)?
function listPrevStartsBlock(m, R) {
  const maxSp = Math.max(0, Math.min(3, R - 1));
  let sp = 0;
  while (sp < m.length && m[sp] === ' ') sp++;
  if (sp > maxSp) return false;
  const c = m[sp];
  if (c === undefined) return false;
  if (c === '`' || c === '~') {
    let k = 0;
    while (m[sp + k] === c) k++;
    if (k < 3) return false;
    if (c === '`' && m.slice(sp + k).includes('`')) return false;
    return true;
  }
  if (c === '#') {
    let k = 0;
    while (m[sp + k] === '#') k++;
    if (k < 1 || k > 6) return false;
    const a = m[sp + k];
    return a === undefined || a === ' ' || a === '\t';
  }
  if (c === '-' || c === '*' || c === '_') {
    let i = sp, count = 0, ok = true;
    while (i < m.length) {
      if (m[i] === c) { count++; i++; }
      else if (m[i] === ' ' || m[i] === '\t') i++;
      else { ok = false; break; }
    }
    if (ok && count >= 3) return true;
    return false;
  }
  if (c === '<') return htmlBlockStartAt(m, R);
  return false;
}

// HTML block condition 1-6 at a line start within the clamped
// indent (same min(3, R-1) rule)
function htmlBlockStartAt(line, R) {
  const maxSp = Math.max(0, Math.min(3, R - 1));
  let sp = 0;
  while (sp < line.length && line[sp] === ' ') sp++;
  if (sp > maxSp) return false;
  const rest = line.slice(sp);
  if (/^<(?:script|pre|style|textarea)(?:[\s>]|$)/i.test(rest)) return true;
  if (/^<!--/.test(rest) || /^<\?/.test(rest) || /^<![A-Za-z]/.test(rest)
    || /^<!\[CDATA\[/.test(rest)) return true;
  if (/^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[\s/>]|$)/i.test(rest)) return true;
  return false;
}

// list; returns {block, next} or null
function tryList(src, pos, st) {
  const first = listStartInfo(src, pos);
  if (!first) return null;
  const n = src.length;
  const items = [];
  let p = pos;
  let loose = false;
  let prevEndedBlank = false;
  while (p < n) {
    const info = listStartInfo(src, p);
    if (!info) break;
    if (info.ordered !== first.ordered || info.delim !== first.delim) break;
    if (isHrLine(src, p)) break;
    const le0 = lineEnd(src, p);
    const g = src.slice(info.contentStart, le0);
    const b = info.bulletCol + info.bw;
    // the first line's content, leading whitespace expanded from the
    // marker's column; R is its content indent
    const m = expandLeadingWS(g, b);
    const y = m.trim() === '';
    let R, d;
    if (y) {
      R = b + 1;
      d = '';
    } else {
      R = m.search(/[^ ]/);
      if (R > 4) R = 1;
      d = m.slice(R);
      R += b;
    }
    p = le0 + 1;
    // an empty item followed by a blank line: the blank is not part
    // of the item
    let u = false;
    if (y && p < n && isBlankLine(src, p)) {
      p = lineEnd(src, p) + 1;
      u = true;
    }
    let mPrev = d;
    let yPrev = y;
    while (p < n && !u) {
      const le = lineEnd(src, p);
      const f = src.slice(p, le);
      const Z = expandLeadingWS(f, 0);
      if (listLineStartsBlock(f, R)) break;
      if (Z.search(/[^ ]/) >= R || f.trim() === '') {
        d += '\n' + Z.slice(R);
      } else {
        // lazy continuation of the item's paragraph
        const prevIndent = mPrev.replace(/\t/g, '    ').search(/[^ ]/);
        if (yPrev || prevIndent >= 4 || listPrevStartsBlock(mPrev, R)) break;
        let qe = f;
        if (/^ {0,3}(?:=+|-+)[ \t]*$/.test(f)
          && setextLevelOfStr(mPrev + '\n' + f)) {
          qe = '    ' + Z.replace(/^ {0,3}/, '');
        }
        d += '\n' + qe;
      }
      yPrev = f.trim() === '';
      p = le + 1;
      mPrev = Z.slice(R);
    }
    // looseness: a blank line at the end of this item's raw text
    // (i.e. before the next item) makes the list loose on the next
    // item; a blank line inside the item is caught when lexing it
    const rawEnd = p;
    const itemRaw = src.slice(pos, rawEnd);
    if (loose) {
      // already loose
    } else if (prevEndedBlank) {
      loose = true;
    } else if (/\n[ \t]*\n[ \t]*$/.test(itemRaw)) {
      prevEndedBlank = true;
    }
    // the next item starts here; remember where this item began
    const itemText = d;
    const info2 = { text: itemText, raw: itemRaw };
    items.push(info2);
    pos = p;
  }
  if (!items.length) return null;
  // the last item's text is trimmed; the others keep their trailing
  // blank lines (they count towards looseness when lexed)
  const lastItem = items[items.length - 1];
  lastItem.text = lastItem.text.replace(/[ \t\n]+$/, '');
  // lex each item's text (top=false: paragraphs become text tokens)
  for (const it of items) {
    const info = { blankBetween: false };
    it.blocks = lexBlocks(it.text, st, false, info);
    if (info.blankBetween) loose = true;
    it.blankBetween = info.blankBetween;
  }
  // task list: the item text starts with [ ] / [x] + whitespace
  for (const it of items) {
    it.task = null;
    const m = /^\[( |x|X)\][ \t]+(?=\S)/.exec(it.text);
    if (m && it.blocks.length
      && (it.blocks[0].type === 'text' || it.blocks[0].type === 'para')) {
      it.task = m[1] === ' ' ? 'unchecked' : 'checked';
      // strip the checkbox only from the first block's text (the
      // first line), not from the whole item text
      it.blocks[0].text = it.blocks[0].text.replace(/^\[(?: |x|X)\][ \t]+/, '');
      it.blocks[0].task = it.task;
      it.text = it.text.replace(/^\[(?: |x|X)\][ \t]+/, '');
    }
  }
  // a loose list turns every text token into a paragraph
  if (loose) {
    for (const it of items) {
      for (const blk of it.blocks) {
        if (blk.type === 'text') blk.type = 'para';
      }
    }
  }
  // marked trims the list token's raw, so trailing blank lines are
  // left for the outer lexer as a space token (which is what makes
  // a list loose when an item ends with a blank line, and what
  // separates the list from the following block)
  let next = p;
  while (next > 0) {
    let contentEnd = next;
    if (src[contentEnd - 1] === '\n') contentEnd--;
    let start = src.lastIndexOf('\n', contentEnd - 1);
    start = start === -1 ? 0 : start + 1;
    if (src.slice(start, contentEnd).trim() === '') {
      next = start;
    } else {
      break;
    }
  }
  return {
    block: {
      type: 'list', ordered: first.ordered,
      start: first.start, tight: !loose, items,
    },
    next,
  };
}

// setext underline level for a two-line string "prev\nline"
function setextLevelOfStr(s) {
  const nl = s.indexOf('\n');
  if (nl === -1) return 0;
  return setextLevelOf(s, nl + 1);
}

// split a table row on unescaped pipes; trims the line and drops a
// leading/trailing pipe cell
function splitTableRow(line) {
  let s = line.trim();
  if (s.charAt(0) === '|') s = s.slice(1);
  const trimmed = s.trimEnd();
  let backslashes = 0;
  for (let i = trimmed.length - 2; i >= 0 && trimmed[i] === '\\'; i--) backslashes++;
  if (trimmed.endsWith('|') && backslashes % 2 === 0) s = trimmed.slice(0, -1);
  const cells = [];
  let cur = '';
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      cur += ch;
      escaped = false;
    } else if (ch === '\\') {
      cur += ch;
      escaped = true;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  // marked's de(): an escaped pipe in a cell becomes a plain pipe
  // before inline parsing (so `a \| b` in a code span renders as
  // a | b, and the pipe does not split the cell)
  return cells.map((cell) => cell.replace(/\\\|/g, '|'));
}

// does a table start at pos (header line + delimiter line with the
// same cell count)? returns the parsed table or null
function tryTable(txt, off) {
  const total = txt.length;
  if (indentOf(txt, off).cols > 3) return null;
  const le = lineEnd(txt, off);
  const headerLine = txt.slice(off, le);
  const dpos = le + 1;
  if (dpos >= total) return null;
  if (indentOf(txt, dpos).cols > 3) return null;
  const dle = lineEnd(txt, dpos);
  const delimLine = txt.slice(dpos, dle);
  // marked's tableDelimiter: a bare --- after a paragraph is a
  // setext heading, not a table — the delimiter row must contain
  // a : or a |
  if (delimLine.indexOf(':') === -1 && delimLine.indexOf('|') === -1) return null;
  const headerCells = splitTableRow(headerLine);
  const delimCells = splitTableRow(delimLine);
  if (headerCells.length === 0 || headerCells.length !== delimCells.length) return null;
  const aligns = [];
  for (const d of delimCells) {
    const t = d.trim();
    if (!/^:?-+:?$/.test(t)) return null;
    let align = null;
    if (t.charAt(0) === ':' && t.charAt(t.length - 1) === ':') align = 'center';
    else if (t.charAt(t.length - 1) === ':') align = 'right';
    else if (t.charAt(0) === ':') align = 'left';
    aligns.push(align);
  }
  const rows = [];
  let p = dle + 1;
  while (p < total) {
    // marked's table body regex stops at a blank line tested as
    // ` *\n` (spaces only): a tab-only line is NOT blank, it is an
    // empty row. An indented-code line (4 spaces / tab) also stops
    // the body (the code alternative in the same lookahead).
    const rle = lineEnd(txt, p);
    let spacesOnly = rle < total;
    for (let i = p; i < rle && spacesOnly; i++) {
      if (txt[i] !== ' ') spacesOnly = false;
    }
    if (spacesOnly) break;
    // indented code (marked's code alternative: 4 spaces, or up
    // to 3 spaces + tab, followed by a non-newline character) also
    // stops the body — but a tab-only line has no character after
    // the tab, so it is an empty row, not code
    let j = p;
    let cols = 0;
    while (j < rle && txt[j] === ' ') {
      cols++;
      j++;
    }
    let isCode = false;
    if (cols >= 4 && j < rle) isCode = true;
    else if (j < rle && txt[j] === '\t' && cols <= 3 && j + 1 < rle) isCode = true;
    if (isCode) break;
    if (startsBlock(txt, p)) break;
    const cells = splitTableRow(txt.slice(p, rle));
    while (cells.length < headerCells.length) cells.push('');
    rows.push(cells.slice(0, headerCells.length));
    p = rle + 1;
  }
  return {
    block: { type: 'table', aligns, header: headerCells, rows },
    next: p,
  };
}

// setext underline level (1 for =, 2 for -) or 0
function setextLevelOf(txt, off) {
  const ind = indentOf(txt, off);
  if (ind.cols > 3) return 0;
  const le = lineEnd(txt, off);
  const c = txt[ind.next];
  if (c !== '=' && c !== '-') return 0;
  let i = ind.next;
  while (i < le && txt[i] === c) i++;
  while (i < le && (txt[i] === ' ' || txt[i] === '\t')) i++;
  if (i !== le || i === ind.next) return 0;
  return c === '=' ? 1 : 2;
}

// paragraph (with setext heading and table detection); always matches
function parseParagraph(txt, off, st) {
  const total = txt.length;
  const lines = [];
  let scan = off;
  let setext = 0;
  let table = null;
  while (scan < total) {
    const le = lineEnd(txt, scan);
    const line = txt.slice(scan, le);
    // a whitespace-only line breaks the paragraph only when it is
    // followed by a newline (marked's lookahead is [ \t]+\n); a
    // trailing whitespace-only line at the end of the input is
    // paragraph content
    if (isBlankLine(txt, scan) && le < total) break;
    if (lines.length > 0) {
      const sl = setextLevelOf(txt, scan);
      if (sl !== 0) {
        setext = sl;
        scan = le + 1;
        break;
      }
      if (lines.length === 1) {
        const t = tryTable(txt, off);
        if (t !== null) {
          table = t;
          scan = t.next;
          break;
        }
      }
      if (tryTable(txt, scan) !== null) break;
      if (startsBlock(txt, scan)) break;
    }
    lines.push(line);
    scan = le + 1;
  }
  if (table !== null) return { block: table.block, next: table.next };
  if (setext !== 0) {
    return {
      block: { type: 'heading', level: setext, text: lines.join('\n').trim() },
      next: scan,
    };
  }
  return { block: { type: 'para', text: lines.join('\n') }, next: scan };
}

// main block lexer. top=false (inside a list item) turns paragraphs
// into single-line text tokens, which merge with following text and
// indented-code tokens the way marked does.
function lexBlocks(txt, st, top, info) {
  if (top === undefined) top = true;
  const blocks = [];
  const total = txt.length;
  let cursor = 0;
  let blankSeen = false;
  while (cursor < total) {
    if (txt[cursor] === '\n') {
      if (info !== undefined && info !== null && blocks.length > 0) info.blankBetween = true;
      blankSeen = true;
      cursor++;
      continue;
    }
    const lineStop = lineEnd(txt, cursor);
    if (isBlankLine(txt, cursor)) {
      if (info !== undefined && info !== null && blocks.length > 0) info.blankBetween = true;
      blankSeen = true;
      cursor = lineStop + 1;
      continue;
    }
    let res = null;
    let blk = null;
    let nxt = cursor;
    let codeFlag = false;
    let definition = null;
    if ((res = tryFences(txt, cursor)) !== null) {
      blk = res.block;
      nxt = res.next;
    } else if ((res = tryHeading(txt, cursor)) !== null) {
      blk = res.block;
      nxt = res.next;
    } else if (isHrLine(txt, cursor)) {
      blk = { type: 'hr' };
      nxt = lineStop + 1;
    } else if ((res = tryBlockquote(txt, cursor, st)) !== null) {
      blk = res.block;
      nxt = res.next;
    } else if ((res = tryList(txt, cursor, st)) !== null) {
      blk = res.block;
      nxt = res.next;
    } else if ((res = tryHtmlBlock(txt, cursor)) !== null) {
      blk = res.block;
      nxt = res.next;
    } else if ((definition = tryDef(txt, cursor)) !== null) {
      nxt = definition.next;
    } else if ((res = tryIndentedCode(txt, cursor)) !== null) {
      blk = res.block;
      nxt = res.next;
      codeFlag = true;
    } else if ((res = tryTable(txt, cursor)) !== null) {
      blk = res.block;
      nxt = res.next;
    } else if (top) {
      res = parseParagraph(txt, cursor, st);
      blk = res.block;
      nxt = res.next;
    } else {
      // inside a list item: a text line followed by a setext
      // underline is a heading (marked tries lheading before the
      // text rule even when top is false)
      const sl = setextLevelOf(txt, lineStop + 1);
      if (sl !== 0 && !isBlankLine(txt, cursor)) {
        blk = { type: 'heading', level: sl, text: txt.slice(cursor, lineStop).trim() };
        nxt = lineEnd(txt, lineStop + 1) + 1;
      } else {
        blk = { type: 'text', text: txt.slice(cursor, lineStop) };
        nxt = lineStop + 1;
      }
    }
    const previous = blocks.length > 0 ? blocks[blocks.length - 1] : null;
    const prevText = blankSeen === false && previous !== null
      && (previous.type === 'para' || previous.type === 'text');
    if (definition !== null) {
      if (prevText) {
        // a def after a paragraph is literal text, not a definition
        previous.text += '\n' + definition.raw;
      } else if (!(definition.label in st.refs)) {
        st.refs[definition.label] = { href: definition.href, title: definition.title };
      }
      cursor = nxt;
      continue;
    }
    if (blk === null) {
      cursor = nxt;
      continue;
    }
    if (codeFlag && prevText) {
      // an indented code block right after a paragraph is merged
      // into it (its text, dedented, appended after a newline)
      previous.text += '\n' + blk.text;
      cursor = nxt;
      continue;
    }
    if ((blk.type === 'para' || blk.type === 'text') && blankSeen === false
      && previous !== null && (previous.type === 'quote' || previous.type === 'list')
      && !(previous.type === 'quote' && previous.endedBlank)) {
      // a lazy paragraph line after a (nested) blockquote or list
      // is a continuation of its innermost paragraph, not a new block
      const inner = innermostPara([previous]);
      if (inner !== null) {
        inner.text += '\n' + blk.text;
        cursor = nxt;
        continue;
      }
    }
    if (blk.type === 'text' && blankSeen === false && previous !== null && previous.type === 'text') {
      previous.text += '\n' + blk.text;
      cursor = nxt;
      continue;
    }
    blocks.push(blk);
    blankSeen = false;
    cursor = nxt;
    if (cursor <= 0) cursor = lineStop + 1;
  }
  return blocks;
}

// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------

function renderBlocks(blocks, st, tight) {
  let out = '';
  for (const blk of blocks) out += renderBlock(blk, st, tight);
  return out;
}

function taskCheckbox(task) {
  if (task === 'checked') return '<input checked="" disabled="" type="checkbox"> ';
  if (task === 'unchecked') return '<input disabled="" type="checkbox"> ';
  return '';
}

function renderBlock(b, st, tight) {
  switch (b.type) {
    case 'text': {
      // a paragraph-like line inside a tight list item: bare inline
      // content, no <p> wrapper, no trailing newline
      return taskCheckbox(b.task) + inlineHtml(b.text, st);
    }
    case 'para': {
      const inner = inlineHtml(b.text, st);
      const cb = taskCheckbox(b.task);
      if (tight) return cb + inner;
      return '<p>' + cb + inner + '</p>\n';
    }
    case 'heading':
      return '<h' + b.level + '>' + inlineHtml(b.text, st) + '</h' + b.level + '>\n';
    case 'code': {
      const lang = b.lang ? ' class="language-' + escKeepRefs(b.lang) + '"' : '';
      // marked's code renderer strips one trailing newline from the
      // text and appends one; an empty text stays empty
      const body = b.text ? esc(b.text.replace(/\n$/, '') + '\n') : '';
      return '<pre><code' + lang + '>' + body + '</code></pre>\n';
    }
    case 'hr':
      return '<hr>\n';
    case 'html':
      return b.text;
    case 'quote':
      return '<blockquote>\n' + renderBlocks(b.blocks, st, false) + '</blockquote>\n';
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      const start = b.ordered && b.start !== 1 ? ' start="' + b.start + '"' : '';
      let out = '<' + tag + start + '>\n';
      for (const item of b.items) {
        out += '<li>' + renderBlocks(item.blocks, st, b.tight) + '</li>\n';
      }
      return out + '</' + tag + '>\n';
    }
    case 'table': {
      let out = '<table>\n<thead>\n<tr>\n';
      for (let i = 0; i < b.header.length; i++) {
        const a = b.aligns[i];
        const alignAttr = a ? ' align="' + a + '"' : '';
        out += '<th' + alignAttr + '>' + inlineHtml(b.header[i], st) + '</th>\n';
      }
      out += '</tr>\n</thead>\n';
      if (b.rows.length > 0) {
        out += '<tbody>';
        for (const row of b.rows) {
          out += '<tr>\n';
          for (let i = 0; i < row.length; i++) {
            const a = b.aligns[i];
            const alignAttr = a ? ' align="' + a + '"' : '';
            out += '<td' + alignAttr + '>' + inlineHtml(row[i], st) + '</td>\n';
          }
          out += '</tr>\n';
        }
        out += '</tbody>';
      }
      return out + '</table>\n';
    }
    default:
      return '';
  }
}

// ------------------------------------------------------------------
// Entry point
// ------------------------------------------------------------------

export function parse(markdown) {
  const state = { refs: Object.create(null), inLink: false, linkEmitted: false };
  const normalized = String(markdown).replace(/\r\n?/g, '\n');
  const blocks = lexBlocks(normalized, state);
  return renderBlocks(blocks, state, false);
}

export default parse;
