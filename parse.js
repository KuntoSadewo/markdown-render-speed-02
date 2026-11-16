// FastMark: a fast Markdown renderer whose output is byte-identical to
// marked 18.1.3 with default options (gfm on, breaks off). Written from
// scratch against the CommonMark 0.31.2 and GFM 0.29 specifications.
const ENT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', iexcl: '¡',
  cent: '¢', pound: '£', curren: '¤', yen: '¥', brvbar: '¦', sect: '§',
  uml: '¨', copy: '©', ordf: 'ª', laquo: '«', not: '¬', shy: '­', reg: '®',
  macr: '¯', deg: '°', plusmn: '±', sup2: '²', sup3: '³', acute: '´',
  micro: 'µ', para: '¶', middot: '·', cedil: '¸', sup1: '¹', ordm: 'º',
  raquo: '»', frac14: '¼', frac12: '½', frac34: '¾', iquest: '¿',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å',
  AElig: 'Æ', Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë',
  Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï', ETH: 'Ð', Ntilde: 'Ñ',
  Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', times: '×',
  Oslash: 'Ø', Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü', Yacute: 'Ý',
  THORN: 'Þ', szlig: 'ß', agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã',
  auml: 'ä', aring: 'å', aelig: 'æ', ccedil: 'ç', egrave: 'è', eacute: 'é',
  ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
  eth: 'ð', ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ',
  ouml: 'ö', divide: '÷', oslash: 'ø', ugrave: 'ù', uacute: 'ú', ucirc: 'û',
  uuml: 'ü', yacute: 'ý', thorn: 'þ', yuml: 'ÿ',
  OElig: 'Œ', oelig: 'œ', Scaron: 'Š', scaron: 'š', Yuml: 'Ÿ', fnof: 'ƒ',
  circ: 'ˆ', tilde: '˜', ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '‌',
  zwj: '‍', lrm: '‎', rlm: '‏', ndash: '–', mdash: '—', lsquo: '‘',
  rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', dagger: '†',
  Dagger: '‡', permil: '‰', lsaquo: '‹', rsaquo: '›', oline: '‾', frasl: '⁄',
  euro: '€', hellip: '…', prime: '′', Prime: '″', larr: '←', uarr: '↑',
  rarr: '→', darr: '↓', harr: '↔', crarr: '↵', forall: '∀', part: '∂',
  exist: '∃', empty: '∅', nabla: '∇', isin: '∈', notin: '∉', ni: '∋',
  prod: '∏', sum: '∑', minus: '−', lowast: '∗', radic: '√', prop: '∝',
  infin: '∞', ang: '∠', and: '∧', or: '∨', cap: '∩', cup: '∪', int: '∫',
  there4: '∴', sim: '∼', cong: '≅', asymp: '≈', ne: '≠', equiv: '≡',
  le: '≤', ge: '≥', sub: '⊂', sup: '⊃', nsub: '⊄', sube: '⊆', supe: '⊇',
  oplus: '⊕', otimes: '⊗', perp: '⊥', sdot: '⋅', lceil: '⌈', rceil: '⌉',
  lfloor: '⌊', rfloor: '⌋', lang: '〈', rang: '〉', loz: '◊', spades: '♠',
  clubs: '♣', hearts: '♥', diams: '♦', trade: '™', bull: '•',
  Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Epsilon: 'Ε', Zeta: 'Ζ',
  Eta: 'Η', Theta: 'Θ', Iota: 'Ι', Kappa: 'Κ', Lambda: 'Λ', Mu: 'Μ',
  Nu: 'Ν', Xi: 'Ξ', Omicron: 'Ο', Pi: 'Π', Rho: 'Ρ', Sigma: 'Σ', Tau: 'Τ',
  Upsilon: 'Υ', Phi: 'Φ', Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
  nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ', sigmaf: 'ς',
  sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ',
  omega: 'ω', thetasym: 'ϑ', upsih: 'ϒ', piv: 'ϖ',
  alefsym: 'ℵ', image: 'ℑ', real: 'ℜ', weierp: '℘',
  lArr: '⇐', uArr: '⇑', rArr: '⇒', dArr: '⇓', hArr: '⇔',
  sbquo2: '‚', Tab: '\t', NewLine: '\n', colon: ':', comma: ',', period: '.',
  sol: '/', bsol: '\\', lpar: '(', rpar: ')', lbrack: '[', rbrack: ']',
  lcub: '{', rcub: '}', verbar: '|', quest: '?', semi: ';', equals: '=',
  plus: '+', minus2: '-', ast: '*', commat: '@', dollar: '$', percnt: '%',
  num: '#', grave: '`', fjlig: 'fj', Hat: '^', check: '✓', cross: '✗',
  star: '☆', phone: '☎', female: '♀', male: '♂', music: '♫',
  eacute2: 'é', Atilde2: 'Ã', sup: '⊃', nsub2: '⊄', aleph: 'ℵ',
  infin2: '∞', empty2: '∅', Delta2: 'Δ',
};
// punctuation escapable with a backslash
const PUNCT = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');
const isSpace = (c) => c === 32 || c === 9 || c === 10 || c === 13;
const isDigit = (c) => c >= 48 && c <= 57;
const isAlpha = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const isAlnum = (c) => isAlpha(c) || isDigit(c);
const isHex = (c) => isDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
const isWs = (c) => c === 32 || c === 9;

function esc(s, encode) {
  let out = '', start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let rep = null;
    if (c === 38) { // &
      if (encode) rep = '&amp;';
      else {
        // keep a valid named-entity-shaped reference raw (any name)
        let j = i + 1;
        const st = j;
        while (isAlnum(s.charCodeAt(j))) j++;
        rep = (j > st && s.charCodeAt(j) === 59) ? null : '&amp;';
      }
    } else if (c === 60) rep = '&lt;';
    else if (c === 62) rep = '&gt;';
    else if (c === 34) rep = '&quot;';
    else if (c === 39) rep = '&#39;';
    if (rep !== null) {
      out += s.slice(start, i) + rep;
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}
const escText = (s) => esc(s, true);

function decodeEntityAt(s, i) {
  // s[i] === '&'; marked decodes NUMERIC character references only.
  // Named entities pass through untouched. Returns [char, endIndex] or null.
  const n = s.length;
  let j = i + 1;
  if (j >= n || s.charCodeAt(j) !== 35) return null;
  j++;
  let code = 0, hex = false;
  if (s.charCodeAt(j) === 120 || s.charCodeAt(j) === 88) { hex = true; j++; }
  const st = j;
  if (hex) { while (j < n && isHex(s.charCodeAt(j))) { if (code <= 0x10FFFF) code = code * 16 + parseInt(s[j], 16); j++; } }
  else { while (j < n && isDigit(s.charCodeAt(j))) { if (code <= 0x10FFFF) code = code * 10 + (s.charCodeAt(j) - 48); j++; } }
  if (j === st || j >= n || s.charCodeAt(j) !== 59) return null;
  if (code > 0x10FFFF) return null;
  if (code === 0 || (code >= 0xD800 && code <= 0xDFFF)) return ['\uFFFD', j + 1];
  return [String.fromCodePoint(code), j + 1];
}

function decodeEntities(s) {
  if (s.indexOf('&') < 0) return s;
  let out = '', start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 38) {
      const d = decodeEntityAt(s, i);
      if (d) {
        out += s.slice(start, i) + d[0];
        start = d[1];
        i = d[1] - 1;
      }
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

const CASE_FOLD_MULTI = { 'ß': 'ss', 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st', 'ǰ': 'ǰ', 'ΐ': 'ΐ', 'ΰ': 'ΰ' };
function caseFoldLabel(s) {
  const lower = s.toLowerCase();
  let out = '';
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    const rep = CASE_FOLD_MULTI[ch];
    out += rep !== undefined ? rep : ch;
  }
  return out;
}

function normalizeLabel(s) {
  // Unicode case folding, collapse whitespace runs to a single space, trim
  const folded = caseFoldLabel(s);
  let out = '', prevWs = true;
  for (let i = 0; i < folded.length; i++) {
    const c = folded.charCodeAt(i);
    if (isSpace(c)) { if (!prevWs) out += ' '; prevWs = true; }
    else { out += folded[i]; prevWs = false; }
  }
  if (out.charCodeAt(out.length - 1) === 32) out = out.slice(0, -1);
  return out;
}

// marked's cleanUrl: encode the href, keeping % intact
function cleanUrl(href) {
  try {
    return encodeURI(href).replace(/%25/g, '%');
  } catch (e) {
    return null;
  }
}
function sanitizeHref(href) {
  if (href == null) return null;
  return cleanUrl(href);
}

// ---------- inline parsing ----------
const ASCII_PUNCT = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');
const PUNCT_RE = /^[\p{P}\p{S}]$/u;
const WS_RE = /^\s$/u;
function isPunctCh(ch) {
  const c = ch.charCodeAt(0);
  if (c < 128) return ASCII_PUNCT.has(ch);
  return PUNCT_RE.test(ch);
}
function isSpaceCh(ch) {
  const c = ch.charCodeAt(0);
  if (c < 128) return c === 32 || c === 9 || c === 10 || c === 13 || c === 11 || c === 12;
  return WS_RE.test(ch);
}
function flanking(s, i, len) {
  const prev = i > 0 ? s[i - 1] : '';
  const next = i + len < s.length ? s[i + len] : '';
  const prevWs = prev === '' || isSpaceCh(prev);
  const nextWs = next === '' || isSpaceCh(next);
  const prevPunct = prev !== '' && isPunctCh(prev);
  const nextPunct = next !== '' && isPunctCh(next);
  const left = !nextWs && (!nextPunct || prevWs || prevPunct);
  const right = !prevWs && (!prevPunct || nextWs || nextPunct);
  return { left, right, prevPunct, nextPunct };
}

function scanCodeSpan(s, i) {
  const n = s.length;
  let j = i;
  while (j < n && s.charCodeAt(j) === 96) j++;
  const len = j - i;
  let k = j;
  while (k < n) {
    if (s.charCodeAt(k) === 96) {
      let m = k;
      while (m < n && s.charCodeAt(m) === 96) m++;
      if (m - k === len) {
        let content = s.slice(j, k).replace(/\n/g, ' ');
        if (content.length >= 2 && content.charCodeAt(0) === 32 && content.charCodeAt(content.length - 1) === 32 && /[^ ]/.test(content)) {
          content = content.slice(1, -1);
        }
        return { content, end: m };
      }
      k = m;
    } else k++;
  }
  return null;
}

// Document-level quirk (marked): an <a> open tag containing a backslash
// immediately before a newline inside the tag, with no </a> in the same
// inline text, disables extended autolinks (email / www / scheme) for the
// rest of the document. A </a> tag clears it. This is per-parse state, reset
// at the start of parse() — it is not cached across cases.
let extAutolinkOff = false;

function scanHtmlTag(s, i) {
  const n = s.length;
  const isTagWs = (c) => c === 32 || c === 9 || c === 10;
  let j = i + 1;
  if (j >= n) return -1;
  const c = s.charCodeAt(j);
  if (c === 33) { // !
    if (s.startsWith('--', j + 1)) {
      if (s.charCodeAt(j + 3) === 62) return j + 4;
      if (s.startsWith('->', j + 3)) return j + 5;
      const k = s.indexOf('-->', j + 4);
      return k < 0 ? -1 : k + 3;
    }
    if (s.startsWith('[CDATA[', j + 1)) {
      const k = s.indexOf(']]>', j + 8);
      return k < 0 ? -1 : k + 3;
    }
    if (j + 1 < n && isAlpha(s.charCodeAt(j + 1))) {
      const k = s.indexOf('>', j + 1);
      return k < 0 ? -1 : k + 1;
    }
    return -1;
  }
  if (c === 63) { // ?
    const k = s.indexOf('?>', j + 1);
    return k < 0 ? -1 : k + 2;
  }
  if (c === 47) { // / closing tag
    j++;
    if (j >= n || !isAlpha(s.charCodeAt(j))) return -1;
    while (j < n && (isAlnum(s.charCodeAt(j)) || s.charCodeAt(j) === 45)) j++;
    while (j < n && isTagWs(s.charCodeAt(j))) j++;
    if (j < n && s.charCodeAt(j) === 62) return j + 1;
    return -1;
  }
  if (!isAlpha(c)) return -1;
  while (j < n && (isAlnum(s.charCodeAt(j)) || s.charCodeAt(j) === 45)) j++;
  for (;;) {
    let k = j;
    while (k < n && isTagWs(s.charCodeAt(k))) k++;
    if (k >= n) return -1;
    const ch = s.charCodeAt(k);
    if (ch === 62) return k + 1;
    if (ch === 47) {
      if (s.charCodeAt(k + 1) === 62) return k + 2;
      return -1;
    }
    // an attribute must be preceded by whitespace (<m:abc> and
    // <a href='bar'title=title> are not tags — cm-609, cm-622)
    if (k === j) return -1;
    if (!(isAlpha(ch) || ch === 95 || ch === 58)) return -1;
    j = k;
    while (j < n) {
      const a = s.charCodeAt(j);
      if (isAlnum(a) || a === 95 || a === 58 || a === 46 || a === 45) j++;
      else break;
    }
    const afterName = j;
    k = j;
    while (k < n && isTagWs(s.charCodeAt(k))) k++;
    if (k < n && s.charCodeAt(k) === 61) {
      k++;
      while (k < n && isTagWs(s.charCodeAt(k))) k++;
      if (k >= n) return -1;
      const q = s.charCodeAt(k);
      if (q === 34 || q === 39) {
        const e = s.indexOf(s[k], k + 1);
        if (e < 0) return -1;
        j = e + 1;
      } else {
        let m = k;
        while (m < n) {
          const a = s.charCodeAt(m);
          if (a === 32 || a === 9 || a === 10 || a === 34 || a === 39 || a === 61 || a === 60 || a === 62 || a === 96) break;
          m++;
        }
        if (m === k) return -1;
        j = m;
      }
    } else {
      // boolean attribute: leave j right after the name so the next loop
      // iteration still sees the whitespace before the next attribute
      // (cm-616: _boolean followed by zoop:33=...)
      j = afterName;
    }
  }
}

const EMAIL_LOCAL = (ch) => {
  const c = ch.charCodeAt(0);
  return isAlnum(c) || '.-!#$%&\'*+/=?^_`{|}~'.indexOf(ch) >= 0;
};
function scanEmailAt(s, i, needDot) {
  // returns {end} if an email starts at i, else null
  const n = s.length;
  let j = i;
  while (j < n && EMAIL_LOCAL(s[j])) j++;
  if (j === i) return null;
  if (j >= n || s.charCodeAt(j) !== 64) return null;
  j++;
  // domain: labels separated by dots, each [a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?
  let dots = 0;
  for (;;) {
    if (j >= n || !isAlnum(s.charCodeAt(j))) return null;
    let k = j;
    while (k < n && (isAlnum(s.charCodeAt(k)) || s.charCodeAt(k) === 45)) k++;
    if (s.charCodeAt(k - 1) === 45) return null; // label ends with -
    j = k;
    if (j < n && s.charCodeAt(j) === 46) {
      // a trailing dot is not part of the domain (a.b-c_d@a.b. links
      // a.b-c_d@a.b and leaves the dot literal — gfm-632/633)
      if (j + 1 < n && isAlnum(s.charCodeAt(j + 1))) { dots++; j++; continue; }
    }
    break;
  }
  if (needDot && dots === 0) return null;
  // a trailing _ is a word character: the address is part of a longer word
  // and is not an autolink (a.b-c_d@a.b_ stays plain — gfm-632/633)
  if (j < n && s.charCodeAt(j) === 95) return null;
  return { end: j };
}
function scanDomainAt(s, i) {
  const n = s.length;
  let j = i, dots = 0;
  for (;;) {
    if (j >= n || !isAlnum(s.charCodeAt(j))) return null;
    let k = j;
    while (k < n && (isAlnum(s.charCodeAt(k)) || s.charCodeAt(k) === 45)) k++;
    if (s.charCodeAt(k - 1) === 45) return null;
    j = k;
    if (j < n && s.charCodeAt(j) === 46) {
      // a trailing dot is not part of the domain
      if (j + 1 < n && isAlnum(s.charCodeAt(j + 1))) { dots++; j++; continue; }
    }
    break;
  }
  if (dots === 0) return null;
  return { end: j };
}
function trimAutolink(text) {
  // trailing punctuation, ) balancing, and trailing &word; entity-like tail
  let t = text;
  for (;;) {
    let changed = false;
    if (/&[a-zA-Z0-9]+;$/.test(t)) {
      t = t.replace(/&[a-zA-Z0-9]+;$/, '');
      changed = true;
    }
    const last = t.charCodeAt(t.length - 1);
    if (last === 63 || last === 33 || last === 46 || last === 44 || last === 58 || last === 59 || last === 42 || last === 95 || last === 126) {
      t = t.slice(0, -1);
      changed = true;
    } else if (last === 41) {
      let open = 0, close = 0;
      for (let i = 0; i < t.length; i++) {
        if (t.charCodeAt(i) === 40) open++;
        else if (t.charCodeAt(i) === 41) close++;
      }
      if (close > open) { t = t.slice(0, -1); changed = true; }
    }
    if (!changed) break;
    if (t.length === 0) break;
  }
  return t;
}
function scanExtendedAutolink(s, i) {
  // i is the start of a candidate; preceding char must allow it
  const n = s.length;
  const prev = i > 0 ? s[i - 1] : '';
  // marked also allows '<' as the preceding character: in
  // <https://foo.bar/baz bim> the < is literal and the URL still links
  // (cm-602)
  if (!(i === 0 || prev === ' ' || prev === '\t' || prev === '\n' || prev === '*' || prev === '_' || prev === '~' || prev === '(' || prev === '<')) return null;
  // www.
  if (s.startsWith('www.', i)) {
    const d = scanDomainAt(s, i + 4);
    if (!d) return null;
    let end = d.end;
    // a path, query or fragment may follow the domain directly
    // (https://cdn.example.net?q=1 — doc-03); a backslash too: it is part
    // of the URL, not a hard break (doc-40: www.flux.com\ links whole);
    // a dot too: example.io..\ is one URL (doc-40), a trailing sentence
    // dot is trimmed back by trimAutolink
    if (end < n && (s.charCodeAt(end) === 47 || s.charCodeAt(end) === 63 || s.charCodeAt(end) === 35 || s.charCodeAt(end) === 92 || s.charCodeAt(end) === 46)) {
      let k = end + 1;
      while (k < n) {
        const c = s.charCodeAt(k);
        if (c === 32 || c === 9 || c === 10 || c === 60 || c === 62) break;
        // a ] followed by ( closes a link text — the URL ends here so the
        // [...](...) link can still form (doc-03: www.sprout.com/install)
        if (c === 93 && s.charCodeAt(k + 1) === 40) break;
        k++;
      }
      end = k;
    }
    let text = trimAutolink(s.slice(i, end));
    if (text.length <= 4) return null;
    return { href: 'http://' + text, text, end: i + text.length };
  }
  // scheme
  let j = i;
  if (isAlpha(s.charCodeAt(j))) {
    j++;
    while (j < n && (isAlnum(s.charCodeAt(j)) || s.charCodeAt(j) === 43 || s.charCodeAt(j) === 46 || s.charCodeAt(j) === 45)) j++;
    if (j - i >= 2 && j - i <= 32 && s.charCodeAt(j) === 58) {
      const after = j + 1;
      if (s.startsWith('//', after)) {
        const d = scanDomainAt(s, after + 2);
        if (d) {
          let end = d.end;
          // a path, query or fragment may follow the domain directly
          // (https://cdn.example.net?q=1 — doc-03); a backslash too: it is
          // part of the URL, not a hard break (doc-40); a dot too:
          // example.io..\ is one URL (doc-40), a trailing sentence dot
          // is trimmed back by trimAutolink
          if (end < n && (s.charCodeAt(end) === 47 || s.charCodeAt(end) === 63 || s.charCodeAt(end) === 35 || s.charCodeAt(end) === 92 || s.charCodeAt(end) === 46)) {
            let k = end + 1;
            while (k < n) {
              const c = s.charCodeAt(k);
              if (c === 32 || c === 9 || c === 10 || c === 60 || c === 62) break;
              // a ] followed by ( closes a link text — the URL ends here
              // so the [...](...) link can still form (doc-03)
              if (c === 93 && s.charCodeAt(k + 1) === 40) break;
              k++;
            }
            end = k;
          }
          const text = trimAutolink(s.slice(i, end));
          if (text.length > j + 2 - i) return { href: text, text, end: i + text.length };
        }
      } else {
        const em = scanEmailAt(s, after, true);
        if (em) {
          let end = em.end;
          if (end < n && s.charCodeAt(end) === 47) {
            let k = end + 1;
            while (k < n) {
              const c = s.charCodeAt(k);
              if (c === 32 || c === 9 || c === 10 || c === 60 || c === 62 || c === 47) break;
              if (c === 93 && s.charCodeAt(k + 1) === 40) break;
              k++;
            }
            // a lone trailing / with no path segment is not part of the
            // link (mailto:a.b-c_d@a.b/ links without the / — gfm-633)
            if (k > end + 1) end = k;
          }
          const text = trimAutolink(s.slice(i, end));
          if (text.length > j + 1 - i) return { href: text, text, end: i + text.length };
        }
      }
    }
  }
  // bare email
  const em = scanEmailAt(s, i, true);
  if (em) {
    const text = s.slice(i, em.end);
    return { href: 'mailto:' + text, text, end: em.end };
  }
  return null;
}
function scanAutolink(s, i) {
  const gt = s.indexOf('>', i + 1);
  if (gt < 0) return null;
  const inner = s.slice(i + 1, gt);
  if (inner.length === 0) return null;
  for (let k = 0; k < inner.length; k++) {
    const c = inner.charCodeAt(k);
    if (c === 32 || c === 9 || c === 10 || c === 60 || c === 62) return null;
  }
  let m = /^[a-zA-Z][a-zA-Z0-9+.-]{1,31}:/.exec(inner);
  if (m) return { href: inner, text: inner, end: gt + 1 };
  if (/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(inner)) {
    return { href: 'mailto:' + inner, text: inner, end: gt + 1 };
  }
  return null;
}

function unescapeStr(s) {
  if (s.indexOf('\\') < 0) return s;
  let out = '', start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 92 && i + 1 < s.length && PUNCT.has(s[i + 1])) {
      out += s.slice(start, i) + s[i + 1];
      start = i + 2;
      i++;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}
function scanLabel(s, i) {
  // s[i] === '['; returns {label, end} where end is index after ']', or null
  const n = s.length;
  let depth = 0, j = i + 1;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (c === 92 && j + 1 < n) { j += 2; continue; }
    if (c === 91) { depth++; j++; continue; }
    if (c === 93) {
      if (depth === 0) {
        const label = s.slice(i + 1, j);
        if (label.length > 999) return null;
        return { label, end: j + 1 };
      }
      depth--; j++; continue;
    }
    j++;
  }
  return null;
}
function parseLinkDest(s, i) {
  // parse a link destination starting at i; returns {dest, end} or null
  const n = s.length;
  if (i >= n) return null;
  if (s.charCodeAt(i) === 60) {
    let j = i + 1;
    while (j < n) {
      const c = s.charCodeAt(j);
      if (c === 92 && j + 1 < n) { j += 2; continue; }
      if (c === 62) return { dest: s.slice(i + 1, j), end: j + 1 };
      if (c === 60 || c === 10) return null;
      j++;
    }
    return null;
  }
  let j = i, depth = 0;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (c === 92 && j + 1 < n) { j += 2; continue; }
    if (c === 32 || c === 9 || c === 10 || c < 32) break;
    if (c === 40) { depth++; j++; continue; }
    if (c === 41) {
      if (depth === 0) break;
      depth--; j++; continue;
    }
    j++;
  }
  if (j === i) return null;
  return { dest: s.slice(i, j), end: j };
}
function skipWs(s, i) {
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10) i++;
    else break;
  }
  return i;
}
function parseTitle(s, i) {
  // returns {title, end} or null; s[i] is ", ' or (
  const n = s.length;
  const q = s.charCodeAt(i);
  if (q === 34 || q === 39) {
    let j = i + 1;
    while (j < n) {
      const c = s.charCodeAt(j);
      if (c === 92 && j + 1 < n) { j += 2; continue; }
      if (c === q) return { title: s.slice(i + 1, j), end: j + 1 };
      j++;
    }
    return null;
  }
  if (q === 40) {
    let j = i + 1;
    while (j < n) {
      const c = s.charCodeAt(j);
      if (c === 92 && j + 1 < n) { j += 2; continue; }
      if (c === 41) return { title: s.slice(i + 1, j), end: j + 1 };
      if (c === 40) return null;
      j++;
    }
    return null;
  }
  return null;
}
function parseLinkSuffix(s, j, rawLabel, refs) {
  // j is the index just after ']'. Returns {href, title, end} or null.
  const n = s.length;
  if (j < n && s.charCodeAt(j) === 40) {
    let i = skipWs(s, j + 1);
    let d;
    if (i < n && s.charCodeAt(i) === 41) {
      // empty destination: [link]() is a valid link with href="" (cm-485)
      d = { dest: '', end: i };
    } else {
      d = parseLinkDest(s, i);
    }
    if (d) {
      i = skipWs(s, d.end);
      let title = null;
      let ok = true;
      if (i < n && (s.charCodeAt(i) === 34 || s.charCodeAt(i) === 39 || s.charCodeAt(i) === 40)) {
        const t = parseTitle(s, i);
        if (!t) ok = false;
        else { title = t.title; i = skipWs(s, t.end); }
      }
      if (ok && i < n && s.charCodeAt(i) === 41) {
        return { href: unescapeStr(d.dest), title: title === null ? null : unescapeStr(title), end: i + 1 };
      }
    }
    // inline link failed: fall through to the shortcut reference link
    // ([foo](not a link) with a [foo] ref still links — cm-568)
  }
  if (j < n && s.charCodeAt(j) === 91) {
    const lab = scanLabel(s, j);
    if (!lab) return null;
    // labels are matched raw (not unescaped) — cm-545
    const key = normalizeLabel(lab.label === '' ? rawLabel : lab.label);
    if (key.length === 0) return null;
    const ref = refs.get(key);
    if (!ref) return null;
    return { href: ref.href, title: ref.title, end: lab.end };
  }
  // shortcut reference link (labels matched raw — cm-545)
  const key = normalizeLabel(rawLabel);
  if (key.length === 0) return null;
  const ref = refs.get(key);
  if (!ref) return null;
  return { href: ref.href, title: ref.title, end: j };
}

function processEmphasis(nodes, delims) {
  let openersBottom = -1;
  let cur = 0;
  while (cur < delims.length) {
    const closer = delims[cur];
    if (closer.c === '[' || closer.c === '![' || !closer.canClose) { cur++; continue; }
    let oi = cur - 1, found = -1;
    while (oi > openersBottom) {
      const op = delims[oi];
      if (op.c === '[' || op.c === '![') { oi--; continue; }
      // odd-match rule (only for * and _): a match is blocked when the sum
      // of the run lengths is a multiple of 3, unless both runs are
      // themselves multiples of 3 (foo***bar***baz forms <em><strong>)
      const odd = closer.c !== '~' && (op.canClose || closer.canOpen) && ((op.len + closer.len) % 3 === 0) && (op.len % 3 !== 0);
      // strikethrough runs must have equal length (~~ needs ~~, ~ needs ~)
      if (op.c === closer.c && op.canOpen && !odd && (closer.c !== '~' || op.len === closer.len)) { found = oi; break; }
      oi--;
    }
    if (found < 0) {
      if (!closer.canOpen) openersBottom = cur - 1;
      cur++;
      continue;
    }
    const opener = delims[found];
    const oi2 = nodes.indexOf(opener.node);
    const ci2 = nodes.indexOf(closer.node);
    if (oi2 < 0 || ci2 < 0 || ci2 <= oi2) {
      // opener is inside an already-formed emphasis node: drop it so the
      // closer can try an earlier opener instead of skipping the match
      delims.splice(found, 1);
      if (openersBottom > found) openersBottom--;
      cur--;
      continue;
    }
    const use = (opener.len >= 2 && closer.len >= 2) ? 2 : 1;
    const tag = closer.c === '~' ? 'del' : (use === 2 ? 'strong' : 'em');
    opener.node.s = opener.node.s.slice(0, opener.node.s.length - use);
    opener.len -= use;
    closer.node.s = closer.node.s.slice(use);
    closer.len -= use;
    const children = nodes.slice(oi2 + 1, ci2);
    const emNode = { t: tag, ch: children };
    const rep = [];
    if (opener.node.s !== '') rep.push(opener.node);
    rep.push(emNode);
    if (closer.node.s !== '') rep.push(closer.node);
    nodes.splice(oi2, ci2 - oi2 + 1, ...rep);
    // Delimiters strictly between the opener and the closer are now inside
    // the formed emphasis node: they can no longer match a delimiter
    // outside it (cm-470: the middle * must not pair with the final *).
    // Remove them, from the end backwards so indices stay valid.
    for (let q = cur - 1; q > found; q--) delims.splice(q, 1);
    // the closer is now immediately after the opener
    cur = found + 1;
    // remove the closer first, then the opener: removing the opener first
    // would shift the closer's index and splice out the wrong delimiter
    if (closer.len === 0) { delims.splice(cur, 1); }
    if (opener.len === 0) { delims.splice(found, 1); cur--; }
  }
}

function plainText(nodes) {
  let out = '';
  for (const nd of nodes) {
    if (nd.t === 'text' || nd.t === 'code' || nd.t === 'html') out += nd.s;
    else if (nd.t === 'br') out += '\n';
    else if (nd.t === 'img') out += nd.alt;
    else if (nd.ch) out += plainText(nd.ch);
  }
  return out;
}
// Links cannot nest: an autolink created inside a link's text reverts to
// plain text when the outer link forms (doc-01/03: a bare URL inside
// [...](...) renders as text, not as a nested <a>). Recursively replaces
// auto-link nodes (marked auto:true at creation) with their text.
function stripAutoLinks(nodes) {
  for (let k = 0; k < nodes.length; k++) {
    const nd = nodes[k];
    if (nd.t === 'link' && nd.auto) {
      nodes[k] = { t: 'text', s: plainText(nd.ch) };
    } else if (nd.ch) {
      stripAutoLinks(nd.ch);
    }
  }
  return nodes;
}
function renderInline(nodes) {
  let out = '';
  for (const nd of nodes) {
    if (nd.t === 'text') out += esc(nd.s, false);
    else if (nd.t === 'code') out += '<code>' + esc(nd.s, true) + '</code>';
    else if (nd.t === 'html') out += nd.s;
    else if (nd.t === 'br') out += '<br>';
    else if (nd.t === 'em') out += '<em>' + renderInline(nd.ch) + '</em>';
    else if (nd.t === 'strong') out += '<strong>' + renderInline(nd.ch) + '</strong>';
    else if (nd.t === 'del') out += '<del>' + renderInline(nd.ch) + '</del>';
    else if (nd.t === 'link') {
      const href = sanitizeHref(nd.href);
      if (href === null) { out += renderInline(nd.ch); continue; }
      out += '<a href="' + esc(href, false) + '"';
      if (nd.title !== null && nd.title !== undefined) out += ' title="' + esc(nd.title, false) + '"';
      out += '>' + renderInline(nd.ch) + '</a>';
    } else if (nd.t === 'img') {
      const src = sanitizeHref(nd.src);
      if (src === null) { out += esc(nd.alt, true); continue; }
      out += '<img src="' + esc(src, false) + '" alt="' + esc(nd.alt, true) + '"';
      if (nd.title !== null && nd.title !== undefined) out += ' title="' + esc(nd.title, false) + '"';
      out += '>';
    }
  }
  return out;
}

function parseInline(text, refs) {
  const s = text;
  const nodes = [];
  const delims = [];
  const n = s.length;
  let i = 0;
  // noMerge: after a backslash escape or a numeric-entity decode produced a
  // character, the next text must start a fresh node, so an escaped/decoded
  // '&' can never merge with following text into a false entity shape.
  let noMerge = false;
  const addText = (str) => {
    const last = nodes[nodes.length - 1];
    if (last && last.t === 'text' && !last.sep && !noMerge) last.s += str;
    else nodes.push({ t: 'text', s: str });
    noMerge = false;
  };
  const addDelimNode = (str) => {
    const nd = { t: 'text', s: str, sep: true };
    nodes.push(nd);
    return nd;
  };
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 10) {
      const last = nodes[nodes.length - 1];
      if (last && last.t === 'text' && !last.sep) {
        let k = last.s.length;
        while (k > 0 && last.s.charCodeAt(k - 1) === 32) k--;
        if (last.s.length - k >= 2) {
          last.s = last.s.slice(0, k);
          nodes.push({ t: 'br' });
          i++;
          while (i < n && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
          continue;
        }
      }
      addText('\n');
      i++;
      continue;
    }
    if (c === 92) {
      const nx = s.charCodeAt(i + 1);
      if (nx === 10) {
        nodes.push({ t: 'br' });
        i += 2;
        while (i < n && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
        continue;
      }
      if (i + 1 < n && PUNCT.has(s[i + 1])) { addText(s[i + 1]); noMerge = true; i += 2; continue; }
      addText('\\');
      i++;
      continue;
    }
    if (c === 38) {
      const d = decodeEntityAt(s, i);
      if (d) { addText(d[0]); noMerge = true; i = d[1]; continue; }
      addText('&');
      i++;
      continue;
    }
    if (c === 96) {
      const cs = scanCodeSpan(s, i);
      if (cs) { nodes.push({ t: 'code', s: cs.content }); i = cs.end; continue; }
      // no closing run of the same length: the whole run is literal text
      // (retrying from the second backtick would wrongly match a shorter
      // closing run — cm-347)
      let j = i;
      while (j < n && s.charCodeAt(j) === 96) j++;
      addText(s.slice(i, j));
      i = j;
      continue;
    }
    if (c === 60) {
      const al = scanAutolink(s, i);
      if (al) {
        // a <...> autolink inside a link's text stays a (nested) link —
        // only bare extended autolinks revert to text (doc-03 vs doc-01)
        nodes.push({ t: 'link', href: al.href, title: null, ch: [{ t: 'text', s: al.text }] });
        i = al.end;
        continue;
      }
      const ht = scanHtmlTag(s, i);
      if (ht > 0) {
        const tag = s.slice(i, ht);
        // an <a> tag with a backslash-newline inside it (and no </a> later
        // in this inline text) turns extended autolinks off until a </a>
        // tag is seen (marked quirk — doc-03)
        const tl = tag.toLowerCase();
        if (tl.startsWith('</a') && (tl.length === 3 || tl.charCodeAt(3) === 32 || tl.charCodeAt(3) === 9 || tl.charCodeAt(3) === 10 || tl.charCodeAt(3) === 62 || tl.charCodeAt(3) === 47)) extAutolinkOff = false;
        else if (tl.startsWith('<a') && (tl.length === 2 || tl.charCodeAt(2) === 32 || tl.charCodeAt(2) === 9 || tl.charCodeAt(2) === 62 || tl.charCodeAt(2) === 47) && tag.indexOf('\\\n') >= 0) {
          if (s.slice(ht).toLowerCase().indexOf('</a') < 0) extAutolinkOff = true;
        }
        nodes.push({ t: 'html', s: tag }); i = ht; continue;
      }
      addText('<');
      i++;
      continue;
    }
    if (c === 33 && s.charCodeAt(i + 1) === 91) {
      const bang = addDelimNode('!');
      const bnode = addDelimNode('[');
      delims.push({ c: '![', node: bnode, len: 0, canOpen: false, canClose: false, active: true, image: true, bracketPos: i + 1, bangNode: bang });
      i += 2;
      continue;
    }
    if (c === 91) {
      const bnode = addDelimNode('[');
      delims.push({ c: '[', node: bnode, len: 0, canOpen: false, canClose: false, active: true, image: false, bracketPos: i });
      i++;
      continue;
    }
    if (c === 93) {
      // nearest [ or ![ opener, active or not: an inactive opener blocks
      // this ] (it becomes literal text and the opener is dropped, so a
      // later ] can still find an earlier ![ — cm-520)
      let di = -1;
      for (let k = delims.length - 1; k >= 0; k--) {
        const d = delims[k];
        if (d.c === '[' || d.c === '![') { di = k; break; }
      }
      if (di < 0) { addText(']'); i++; continue; }
      const opener = delims[di];
      if (!opener.active) {
        delims.splice(di, 1);
        addText(']');
        i++;
        continue;
      }
      const rawLabel = s.slice(opener.bracketPos + 1, i);
      const res = parseLinkSuffix(s, i + 1, rawLabel, refs);
      if (!res) {
        delims.splice(di, 1);
        addText(']');
        i++;
        continue;
      }
      const isImage = opener.image;
      const oi = nodes.indexOf(opener.node);
      const children = nodes.slice(oi + 1);
      const inner = delims.slice(di + 1).filter((d) => d.c !== '[' && d.c !== '![');
      processEmphasis(children, inner);
      // an autolink inside a link's text reverts to plain text (no nesting)
      stripAutoLinks(children);
      delims.length = di;
      if (!isImage) {
        // forming a link deactivates earlier [ openers, but NOT ![ openers
        // (an image may still form later — cm-520)
        for (let k = 0; k < delims.length; k++) {
          if (delims[k].c === '[') delims[k].active = false;
        }
      }
      delims.splice(di, 1);
      let start = oi;
      if (isImage) start = oi - 1;
      const node = isImage
        ? { t: 'img', src: res.href, title: res.title, alt: plainText(children) }
        : { t: 'link', href: res.href, title: res.title, ch: children };
      nodes.splice(start, nodes.length - start, node);
      i = res.end;
      continue;
    }
    if (c === 42 || c === 95 || c === 126) {
      let j = i;
      while (j < n && s.charCodeAt(j) === c) j++;
      const len = j - i;
      // strikethrough runs are only 1 or 2 tildes; 3+ are literal text
      if (c === 126 && len > 2) { addText(s.slice(i, j)); i = j; continue; }
      const fl = flanking(s, i, len);
      const nd = addDelimNode(s.slice(i, j));
      let canOpen, canClose;
      if (c === 95) {
        canOpen = fl.left && (!fl.right || fl.prevPunct);
        canClose = fl.right && (!fl.left || fl.nextPunct);
      } else {
        canOpen = fl.left;
        canClose = fl.right;
      }
      delims.push({ c: String.fromCharCode(c), node: nd, len, canOpen, canClose, active: false, image: false, bracketPos: -1 });
      i = j;
      continue;
    }
    if (c === 119 || c === 104 || c === 102 || c === 109 || c === 120 || isAlpha(c) || isDigit(c)) {
      const al = extAutolinkOff ? null : scanExtendedAutolink(s, i);
      if (al) {
        nodes.push({ t: 'link', href: al.href, title: null, ch: [{ t: 'text', s: al.text }], auto: true });
        i = al.end;
        continue;
      }
      addText(s[i]);
      i++;
      continue;
    }
    addText(s[i]);
    i++;
  }
  processEmphasis(nodes, delims);
  return nodes;
}

// ---------- block parsing ----------
// A line is {s: string, last: boolean, col: number, nl: boolean}.
// `col` is the absolute column of s[0] in the original document line, so tab
// stops are always computed against the real column. `nl` is true when the
// line is followed by a newline in the source.
function mkLine(s, col, last, nl) { return { s, col, last, nl }; }
function firstNonSpace(line) {
  const s = line.s;
  let i = 0, col = line.col || 0;
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 32) { i++; col++; }
    else if (c === 9) { const adv = 4 - (col % 4); i++; col += adv; }
    else break;
  }
  return { idx: i, col };
}
// relative indent of the first non-space char against the line's own base
function relIndent(line, fns) { return fns.col - (line.col || 0); }
function isBlank(line) {
  const s = line.s;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c !== 32 && c !== 9) return false;
  }
  return true;
}
// Remove up to n columns of leading whitespace from a line. A tab straddling
// the boundary is replaced by the spaces that remain after it, matching the
// reference tab-expansion rule. Returns a new line whose col is the absolute
// column of its first character.
function stripCols(line, n) {
  const s = line.s;
  const target = (line.col || 0) + n;
  let i = 0, col = line.col || 0;
  while (i < s.length && col < target) {
    const c = s.charCodeAt(i);
    if (c === 32) { i++; col++; }
    else if (c === 9) {
      const adv = 4 - (col % 4);
      if (col + adv > target) return { s: ' '.repeat(col + adv - target) + s.slice(i + 1), col: target, last: line.last, nl: line.nl };
      i++; col += adv;
    } else break;
  }
  return { s: s.slice(i), col, last: line.last, nl: line.nl };
}
// Like stripCols, but also expands any tab left in the leading whitespace to
// spaces (by its absolute column). Used when a container (list item /
// blockquote) strips a line that will be re-parsed: a tab left in the leading
// whitespace would be misread as indentation, so it must become spaces
// (doc-01: '  \tfoo' inside a list item renders '  foo', not '\tfoo').
// Block strips (fence / indented code) keep stripCols and preserve the tab.
function stripColsExpand(line, n) {
  const r = stripCols(line, n);
  const s = r.s;
  let i = 0, col = r.col || 0, out = '';
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 32) { out += ' '; i++; col++; }
    else if (c === 9) { const adv = 4 - (col % 4); out += ' '.repeat(adv); i++; col += adv; }
    else break;
  }
  if (out === '') return r;
  return { s: out + s.slice(i), col: r.col, last: r.last, nl: r.nl };
}
// Slice a line at an absolute column (the content column of a list item).
// Unlike stripCols this consumes non-whitespace characters too (the marker),
// so a tab straddling the column is replaced by its remaining spaces.
function sliceAtCol(line, targetCol) {
  const s = line.s;
  let i = 0, col = line.col || 0;
  while (i < s.length && col < targetCol) {
    const c = s.charCodeAt(i);
    if (c === 32) { i++; col++; }
    else if (c === 9) {
      const adv = 4 - (col % 4);
      if (col + adv > targetCol) return { s: ' '.repeat(col + adv - targetCol) + s.slice(i + 1), col: targetCol, last: line.last, nl: line.nl };
      i++; col += adv;
    } else { i++; col++; }
  }
  return { s: s.slice(i), col, last: line.last, nl: line.nl };
}
// what remains is a setext underline, indent it by 4 spaces so it cannot be
// one (cm-093). The prepended spaces are virtual: the line keeps its base
// column so the underline sits at a relative indent of 4.
// A lazy continuation keeps its leading whitespace when it is under 4
// columns (doc-25: ' fn main()' keeps its space; '> foo\n bar' keeps the
// space) — only a 4-column indent is stripped, so '    - bar' becomes
// '- bar' (cm-238). Stripping 1-3 spaces would eat paragraph content.
function lazyLine(line) {
  // a setext underline as a lazy line must be neutralised first (cm-093:
  // '=== ' after a lazy 'bar' becomes '    ===' in the paragraph) —
  // regardless of how much leading whitespace it has
  const fns0 = firstNonSpace(line);
  if (isSetextLine(line, fns0)) {
    return { s: '    ' + line.s, col: line.col || 0, last: line.last, nl: line.nl, lazy: true };
  }
  let col = line.col || 0, i = 0;
  while (i < line.s.length) {
    const c = line.s.charCodeAt(i);
    if (c === 32) { i++; col++; }
    else if (c === 9) { col += 4 - (col % 4); i++; }
    else break;
  }
  const leadCols = col - (line.col || 0);
  if (leadCols < 4) {
    return { s: line.s, col: line.col || 0, last: line.last, nl: line.nl, lazy: true };
  }
  const stripped = stripCols(line, 4);
  const fns = firstNonSpace(stripped);
  if (isSetextLine(stripped, fns)) {
    return { s: '    ' + stripped.s, col: line.col || 0, last: line.last, nl: line.nl, lazy: true };
  }
  return { s: stripped.s, col: stripped.col, last: line.last, nl: line.nl, lazy: true };
}
function colsOf(s, from, to) {
  let col = 0;
  for (let i = from; i < to; i++) {
    if (s.charCodeAt(i) === 9) col += 4 - (col % 4);
    else col++;
  }
  return col;
}

function skipWsNewlines(s, i) {
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10) i++;
    else break;
  }
  return i;
}
function tryParseRefDef(s, i) {
  if (s.charCodeAt(i) !== 91) return null;
  const lab = scanLabel(s, i);
  if (!lab || lab.label.length === 0) return null;
  // a reference label must not contain an unescaped [ (cm-547/548/590)
  for (let q = 0; q < lab.label.length; q++) {
    if (lab.label.charCodeAt(q) === 92) { q++; continue; }
    if (lab.label.charCodeAt(q) === 91) return null;
  }
  // labels are matched raw (not unescaped): foo\! does not match foo!
  // (cm-545); a label that normalizes to empty is invalid (cm-552)
  const key = normalizeLabel(lab.label);
  if (key.length === 0) return null;
  let j = lab.end;
  if (s.charCodeAt(j) !== 58) return null;
  j++;
  j = skipWsNewlines(s, j);
  const d = parseLinkDest(s, j);
  if (!d) return null;
  j = d.end;
  // after the destination: spaces/tabs on the same line, then an optional
  // title (same line, separated by whitespace — cm-201 — or next line)
  let p = j;
  while (p < s.length && (s.charCodeAt(p) === 32 || s.charCodeAt(p) === 9)) p++;
  let title = null;
  let end;
  if (p < s.length && (s.charCodeAt(p) === 34 || s.charCodeAt(p) === 39 || s.charCodeAt(p) === 40)) {
    if (p === j) return null; // no whitespace between destination and title
    const t = parseTitle(s, p);
    if (!t) return null;
    title = t.title;
    let q = t.end;
    while (q < s.length && (s.charCodeAt(q) === 32 || s.charCodeAt(q) === 9)) q++;
    if (q < s.length && s.charCodeAt(q) !== 10) return null;
    end = q < s.length ? q + 1 : q;
  } else if (p < s.length && s.charCodeAt(p) === 10) {
    // maybe a title on the next line
    let q = p + 1;
    while (q < s.length && (s.charCodeAt(q) === 32 || s.charCodeAt(q) === 9)) q++;
    if (q < s.length && (s.charCodeAt(q) === 34 || s.charCodeAt(q) === 39 || s.charCodeAt(q) === 40)) {
      const t = parseTitle(s, q);
      let ok = false;
      if (t) {
        let r = t.end;
        while (r < s.length && (s.charCodeAt(r) === 32 || s.charCodeAt(r) === 9)) r++;
        if (r >= s.length || s.charCodeAt(r) === 10) {
          title = t.title;
          end = r < s.length ? r + 1 : r;
          ok = true;
        }
      }
      // malformed title or junk after it on the next line: the definition
      // ends at the destination's line, with no title (cm-210)
      if (!ok) end = p + 1;
    } else {
      end = p + 1; // no title; the definition ends at the newline
    }
  } else if (p >= s.length) {
    end = p;
  } else {
    return null; // trailing junk after the destination on the same line
  }
  return {
    key,
    href: unescapeStr(d.dest),
    title: title === null ? null : unescapeStr(title),
    end,
  };
}
function extractRefs(paraLines, refs) {
  const joined = paraLines.map((l) => l.s).join('\n');
  const lineStarts = [0];
  for (let k = 0; k < joined.length; k++) if (joined.charCodeAt(k) === 10) lineStarts.push(k + 1);
  let li = 0, pos = 0;
  while (li < paraLines.length) {
    const ls = lineStarts[li];
    let p = ls, col = 0;
    while (p < joined.length) {
      const c = joined.charCodeAt(p);
      if (c === 32) { p++; col++; if (col >= 4) break; }
      else if (c === 9) { col += 4 - (col % 4); if (col >= 4) break; p++; }
      else break;
    }
    if (col >= 4) break;
    const def = tryParseRefDef(joined, p);
    if (!def) break;
    if (!refs.has(def.key)) refs.set(def.key, { href: def.href, title: def.title });
    // count lines consumed: def.end is a char index at a line start (or EOF)
    let nli = li;
    while (nli + 1 < lineStarts.length && lineStarts[nli + 1] <= def.end) nli++;
    if (def.end >= joined.length) nli = paraLines.length;
    li = nli;
    pos = def.end;
    if (li >= paraLines.length) break;
  }
  return paraLines.slice(li);
}

const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem meta nav noframes ol optgroup option p param section source summary table tbody td tfoot th thead title tr track ul').split(' '));
function htmlBlockStart(line, fns) {
  if (relIndent(line, fns) > 3) return null;
  const s = line.s;
  const rest = s.slice(fns.idx);
  const lower = rest.toLowerCase();
  // type 1: <script, <pre, <style, <textarea followed by ws, '>', '/' or EOL.
  // The tag need not be complete on this line (attributes may span lines).
  const t1 = [['<script', 'script'], ['<pre', 'pre'], ['<style', 'style'], ['<textarea', 'textarea']];
  for (let q = 0; q < t1.length; q++) {
    const name = t1[q][0];
    if (lower.startsWith(name)) {
      const nc = rest.charCodeAt(name.length);
      if (!nc || nc === 32 || nc === 9 || nc === 62 || nc === 47) {
        return { type: 1, endRe: new RegExp('</' + t1[q][1] + '>', 'i') };
      }
      break;
    }
  }
  if (lower.startsWith('<!--')) return { type: 2, endRe: /-->/ };
  if (lower.startsWith('<?')) return { type: 3, endRe: /\?>/ };
  if (lower.startsWith('<!') && rest.length > 2 && isAlpha(rest.charCodeAt(2))) return { type: 4, endRe: />/ };
  if (lower.startsWith('<![cdata[')) return { type: 5, endRe: /\]\]>/ };
  // type 6: a block tag name followed by ws, '>', '/' or EOL (tag may span lines)
  const m6 = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(rest);
  if (m6) {
    const name = m6[1].toLowerCase();
    const nc = rest.charCodeAt(m6[0].length);
    if (BLOCK_TAGS.has(name) && (!nc || nc === 32 || nc === 9 || nc === 62 || nc === 47)) return { type: 6, endRe: null };
  }
  // type 7: a complete open/closing tag, nothing but whitespace after it.
  // A closing tag has no attributes (</a href="foo"> is not a tag — cm-624).
  let m;
  if (rest.startsWith('</')) {
    m = /^<\/([a-zA-Z][a-zA-Z0-9-]*)[ \t]*>/.exec(rest);
  } else {
    m = /^<([a-zA-Z][a-zA-Z0-9-]*)((?:[ \t]+[a-zA-Z_:][a-zA-Z0-9_.:-]*(?:[ \t]*=[ \t]*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)[ \t]*\/?>/.exec(rest);
  }
  if (m) {
    const name = m[1].toLowerCase();
    const after = rest.slice(m[0].length);
    if (!BLOCK_TAGS.has(name) && /^[ \t]*$/.test(after)) return { type: 7, endRe: null };
  }
  return null;
}
function isSetextLine(line, fns) {
  if (relIndent(line, fns) > 3) return 0;
  const s = line.s;
  let i = fns.idx;
  const c = s.charCodeAt(i);
  if (c !== 61 && c !== 45) return 0;
  let count = 0;
  while (i < s.length && s.charCodeAt(i) === c) { count++; i++; }
  while (i < s.length && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
  if (i !== s.length || count === 0) return 0;
  return c === 61 ? 1 : 2;
}
function isThematicBreak(line, fns) {
  if (relIndent(line, fns) > 3) return false;
  const s = line.s;
  let i = fns.idx;
  const c = s.charCodeAt(i);
  if (c !== 45 && c !== 95 && c !== 42) return false;
  let count = 0;
  while (i < s.length) {
    const ch = s.charCodeAt(i);
    if (ch === c) { count++; i++; }
    else if (ch === 32 || ch === 9) i++;
    else return false;
  }
  return count >= 3;
}
function atxHeading(line, fns) {
  if (relIndent(line, fns) > 3) return null;
  const s = line.s;
  let i = fns.idx;
  if (s.charCodeAt(i) !== 35) return null;
  let count = 0;
  while (s.charCodeAt(i) === 35) { count++; i++; }
  if (count > 6) return null;
  if (i < s.length && s.charCodeAt(i) !== 32 && s.charCodeAt(i) !== 9) return null;
  let rest = s.slice(i);
  // closing sequence first (it is preceded by a space, even when it is the
  // whole remainder, e.g. '### ###'), then strip leading/trailing spaces
  rest = rest.replace(/[ \t]+#+[ \t]*$/, '');
  rest = rest.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
  return { level: count, text: rest };
}
function fenceStart(line, fns) {
  const ind = relIndent(line, fns);
  if (ind > 3) return null;
  const s = line.s;
  const c = s.charCodeAt(fns.idx);
  if (c !== 96 && c !== 126) return null;
  let i = fns.idx, len = 0;
  while (s.charCodeAt(i) === c) { len++; i++; }
  if (len < 3) return null;
  const info = s.slice(i);
  if (c === 96 && info.indexOf('`') >= 0) return null;
  return { ch: c, len, indent: ind, info };
}
// is this line the closing fence for an open fence (run >= len, only
// whitespace after it)?
function isFenceClose(line, ch, len) {
  const fns = firstNonSpace(line);
  if (relIndent(line, fns) > 3) return false;
  if (line.s.charCodeAt(fns.idx) !== ch) return false;
  let k = fns.idx, run = 0;
  while (line.s.charCodeAt(k) === ch) { run++; k++; }
  if (run < len) return false;
  return /^[ \t]*$/.test(line.s.slice(k));
}
function unescapeTablePipe(cell) {
  // an escaped pipe \| in a table cell renders as | (even inside a code
  // span — gfm-200). A backslash that is itself escaped (\\|) does not
  // escape the pipe, so only replace \| preceded by an even number of
  // backslashes.
  if (cell.indexOf('\\|') < 0) return cell;
  let out = '', start = 0;
  for (let i = 0; i < cell.length; i++) {
    if (cell.charCodeAt(i) === 92 && i + 1 < cell.length && cell.charCodeAt(i + 1) === 124) {
      let b = 0;
      for (let q = i - 1; q >= 0 && cell.charCodeAt(q) === 92; q--) b++;
      if (b % 2 === 0) { out += cell.slice(start, i) + '|'; start = i + 2; i++; }
    }
  }
  return start === 0 ? cell : out + cell.slice(start);
}
function splitTableRow(line) {
  // returns array of cell strings, or null if the line cannot be a table row part
  const s = line;
  let cells = [];
  let i = 0;
  const n = s.length;
  while (i < n && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
  if (s.charCodeAt(i) === 124) i++;
  let cur = '';
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 92 && i + 1 < n) { cur += s[i] + s[i + 1]; i += 2; continue; }
    if (c === 96) {
      let j = i;
      while (j < n && s.charCodeAt(j) === 96) j++;
      const len = j - i;
      let k = j, found = -1;
      while (k < n) {
        if (s.charCodeAt(k) === 96) {
          let m = k;
          while (m < n && s.charCodeAt(m) === 96) m++;
          if (m - k === len) { found = m; break; }
          k = m;
        } else k++;
      }
      if (found >= 0) { cur += s.slice(i, found); i = found; continue; }
      cur += s[i]; i++; continue;
    }
    if (c === 124) {
      cells.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += s[i];
    i++;
  }
  cells.push(cur);
  // drop a trailing empty cell if the line ended with an (unescaped) pipe
  let t = s.length - 1;
  while (t >= 0 && (s.charCodeAt(t) === 32 || s.charCodeAt(t) === 9)) t--;
  if (t >= 0 && s.charCodeAt(t) === 124) {
    // check the pipe is not escaped
    let b = 0, q = t - 1;
    while (q >= 0 && s.charCodeAt(q) === 92) { b++; q--; }
    if (b % 2 === 0) cells.pop();
  }
  return cells.map((x) => unescapeTablePipe(x.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')));
}
function isDelimiterRow(line) {
  const fns = firstNonSpace(line);
  if (relIndent(line, fns) > 3) return null;
  const cells = splitTableRow(line.s);
  if (!cells || cells.length === 0) return null;
  const aligns = [];
  for (const cell of cells) {
    const m = /^:?-+:?$/.exec(cell);
    if (!m) return null;
    aligns.push(cell.charCodeAt(0) === 58 ? (cell.charCodeAt(cell.length - 1) === 58 ? 2 : 1) : (cell.charCodeAt(cell.length - 1) === 58 ? 3 : 0));
  }
  return aligns;
}
function parseListMarker(line) {
  const fns = firstNonSpace(line);
  const base = line.col || 0;
  const markerCol = fns.col - base;
  if (markerCol > 3) return null;
  const s = line.s;
  let i = fns.idx;
  const c = s.charCodeAt(i);
  let ordered = false, bullet = '', delim = '', start = 0, markerLen = 0;
  if (c === 45 || c === 43 || c === 42) {
    bullet = s[i];
    markerLen = 1;
    i++;
  } else if (isDigit(c)) {
    let j = i, num = 0, digits = 0;
    while (j < s.length && isDigit(s.charCodeAt(j)) && digits < 9) { num = num * 10 + (s.charCodeAt(j) - 48); j++; digits++; }
    if (digits === 0 || digits > 9) return null;
    if (j >= s.length || (s.charCodeAt(j) !== 46 && s.charCodeAt(j) !== 41)) return null;
    // a run of more than 9 digits is not a marker
    if (j < s.length && isDigit(s.charCodeAt(j))) return null;
    ordered = true;
    delim = s[j];
    start = num;
    markerLen = j - i + 1;
    i = j + 1;
  } else return null;
  // whitespace after the marker
  if (i >= s.length) {
    return { ordered, bullet, delim, start, markerCol, markerLen, contentIndent: markerCol + 2, empty: true, markerEndCol: markerCol + markerLen };
  }
  const wc = s.charCodeAt(i);
  if (wc !== 32 && wc !== 9) return null;
  // count whitespace columns (absolute columns, tabs to tab stops)
  let col = fns.col + markerLen, wsCols = 0;
  let k = i;
  while (k < s.length) {
    const ch = s.charCodeAt(k);
    if (ch === 32) { k++; col++; wsCols++; }
    else if (ch === 9) { const adv = 4 - (col % 4); k++; col += adv; wsCols += adv; }
    else break;
  }
  if (k >= s.length) {
    return { ordered, bullet, delim, start, markerCol, markerLen, contentIndent: markerCol + 2, empty: true, markerEndCol: markerCol + markerLen };
  }
  let contentIndent;
  if (wsCols >= 1 && wsCols <= 4) contentIndent = markerCol + markerLen + wsCols;
  else contentIndent = markerCol + markerLen + 1;
  return { ordered, bullet, delim, start, markerCol, markerLen, contentIndent, empty: false, markerEndCol: markerCol + markerLen, contentStart: k };
}

function lineKind(line) {
  if (isBlank(line)) return 'blank';
  const fns = firstNonSpace(line);
  if (isSetextLine(line, fns)) return 'setext';
  if (atxHeading(line, fns)) return 'blockstart';
  if (fenceStart(line, fns)) return 'blockstart';
  const hb = htmlBlockStart(line, fns);
  if (hb && hb.type !== 7) return 'blockstart';
  if (isThematicBreak(line, fns)) return 'blockstart';
  const m = parseListMarker(line);
  if (m) {
    if (!m.empty && (!m.ordered || m.start === 1)) return 'blockstart';
    return 'para';
  }
  if (relIndent(line, fns) <= 3 && line.s.charCodeAt(fns.idx) === 62) return 'blockstart';
  return 'para';
}
function isBlockStartInterrupt(line) {
  return lineKind(line) === 'blockstart';
}
// Is the tip of the blocks built from `line` (added to a container whose
// current tip is a paragraph when tipPara is true) a paragraph? Used to
// decide whether a following line may be a lazy continuation. Recurses into
// list items and blockquotes, and treats an indented-code line as a paragraph
// only when a paragraph is already open (cm-236 vs cm-238, cm-250).
function tipIsPara(line, tipPara) {
  if (isBlank(line)) return false;
  const fns = firstNonSpace(line);
  if (isSetextLine(line, fns)) return false;
  if (atxHeading(line, fns) || fenceStart(line, fns) || isThematicBreak(line, fns)) return false;
  const hb = htmlBlockStart(line, fns);
  if (hb && hb.type !== 7) return false;
  if (relIndent(line, fns) >= 4 && !tipPara) return false;
  const m = parseListMarker(line);
  if (m) {
    if (m.empty) return false;
    const cl = sliceAtCol(line, (line.col || 0) + m.contentIndent);
    return tipIsPara(cl, false);
  }
  if (relIndent(line, fns) <= 3 && line.s.charCodeAt(fns.idx) === 62) {
    let l2 = { s: line.s.slice(fns.idx + 1), col: fns.col + 1, last: line.last, nl: line.nl };
    const c0 = l2.s.charCodeAt(0);
    if (c0 === 32 || c0 === 9) l2 = stripCols(l2, 1);
    if (isBlank(l2)) return false;
    return tipIsPara(l2, false);
  }
  return true;
}
// Is the line a block start in a fresh context (no paragraph open)? Any
// valid list marker counts, including an ordered marker with start != 1
// and an empty marker (cm-302: "3) baz" ends the item, it is not a lazy
// continuation). Indented code is excluded: it is a paragraph continuation
// when a paragraph is already open.
function isFreshBlockStart(line) {
  if (isBlank(line)) return false;
  const fns = firstNonSpace(line);
  if (isSetextLine(line, fns)) return false;
  if (atxHeading(line, fns)) return true;
  if (fenceStart(line, fns)) return true;
  const hb = htmlBlockStart(line, fns);
  if (hb && hb.type !== 7) return true;
  if (isThematicBreak(line, fns)) return true;
  if (parseListMarker(line)) return true;
  if (relIndent(line, fns) <= 3 && line.s.charCodeAt(fns.idx) === 62) return true;
  return false;
}
// any line that is not a block start able to interrupt a paragraph. A setext
// underline is eligible (it becomes indented text, see lazyLine); a thematic
// break is not.
function isLazyLine(line) {
  if (isBlank(line)) return false;
  const fns = firstNonSpace(line);
  if (isThematicBreak(line, fns)) return false;
  if (isSetextLine(line, fns)) return true;
  return !isFreshBlockStart(line);
}

function parseBlocks(lines, refs, inItem) {
  const blocks = [];
  let i = 0;
  let para = null;
  let blankBetween = false;
  let sawBlank = false;
  const ensureRefs = () => {
    if (para && !para.extracted) {
      para.lines = extractRefs(para.lines, refs);
      para.extracted = true;
    }
  };
  const flushPara = () => {
    if (!para) return;
    ensureRefs();
    if (para.lines.length > 0) {
      if (sawBlank && blocks.length > 0) blankBetween = true;
      blocks.push({ t: 'para', text: para.lines.map((l) => l.s).join('\n') });
    }
    para = null;
  };
  const pushBlock = (b) => {
    if (sawBlank && blocks.length > 0) blankBetween = true;
    blocks.push(b);
    sawBlank = false;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      // a trailing whitespace-only line is part of the open paragraph
      // (cm-241: > foo / >   keeps the spaces), not a blank separator
      if (para && line.last && line.s.length > 0) { para.lines.push(line); i++; continue; }
      flushPara();
      sawBlank = true;
      i++;
      continue;
    }
    const fns = firstNonSpace(line);
    if (para) {
      // a lazy continuation line was already stripped of its container
      // prefix: it joins the open paragraph directly instead of being
      // re-parsed as a block start (cm-238: " - bar" stays paragraph text)
      if (line.lazy) { para.lines.push(line); i++; continue; }
      const se = isSetextLine(line, fns);
      if (se) {
        ensureRefs();
        if (para.lines.length > 0) {
          // setext content: strip leading whitespace of the first line and
          // trailing whitespace of the last line (cm-082, cm-084, cm-089)
          const ls = para.lines.map((l) => l.s);
          ls[0] = ls[0].replace(/^[ \t]+/, '');
          ls[ls.length - 1] = ls[ls.length - 1].replace(/[ \t]+$/, '');
          const text = ls.join('\n');
          para = null;
          pushBlock({ t: 'heading', level: se, text });
          i++;
          continue;
        }
        // the paragraph was only reference definitions: it is gone, and the
        // underline line is the start of a fresh block (cm-216)
        flushPara();
      } else {
        const aligns = isDelimiterRow(line);
        if (aligns) {
          ensureRefs();
          if (para.lines.length === 1) {
            const header = splitTableRow(para.lines[0].s);
            if (header && header.length === aligns.length) {
              para = null;
              const tbl = { t: 'table', header, align: aligns, rows: [] };
              pushBlock(tbl);
              i++;
              while (i < lines.length) {
                const rl = lines[i];
                // a line of only spaces (or empty) ends the table, but a
                // line containing a tab is an (empty) table row, not a
                // blank line — doc-02: a lone \t row renders empty cells
                if (/^[ ]*$/.test(rl.s)) break;
                if (isBlockStartInterrupt(rl)) break;
                const cells = splitTableRow(rl.s);
                while (cells.length < header.length) cells.push('');
                tbl.rows.push(cells.slice(0, header.length));
                i++;
              }
              continue;
            }
          }
        }
        const bs = blockStart(lines, i, true, refs, inItem);
        if (bs) {
          flushPara();
          for (const b of bs.blocks) pushBlock(b);
          i = bs.next;
          continue;
        }
        para.lines.push(line);
        i++;
        continue;
      }
    }
    const bs = blockStart(lines, i, false, refs, inItem);
    if (bs) {
      for (const b of bs.blocks) pushBlock(b);
      i = bs.next;
      continue;
    }
    // a paragraph's first line keeps its leading spaces (cm-056); a blank
    // line before it makes the enclosing list loose (cm-317/325)
    if (sawBlank && blocks.length > 0) blankBetween = true;
    para = { lines: [line], extracted: false };
    i++;
  }
  flushPara();
  return { blocks, blankBetween };
}

function blockStart(lines, i, inPara, refs, inItem) {
  const line = lines[i];
  const fns = firstNonSpace(line);
  const atx = atxHeading(line, fns);
  if (atx) return { blocks: [{ t: 'heading', level: atx.level, text: atx.text }], next: i + 1 };
  const fe = fenceStart(line, fns);
  if (fe) {
    const content = [];
    let j = i + 1;
    let closed = false;
    while (j < lines.length) {
      const cl = lines[j];
      const cfns = firstNonSpace(cl);
      if (relIndent(cl, cfns) <= 3 && cl.s.charCodeAt(cfns.idx) === fe.ch) {
        let k = cfns.idx, run = 0;
        while (cl.s.charCodeAt(k) === fe.ch) { run++; k++; }
        if (run >= fe.len && /^[ \t]*$/.test(cl.s.slice(k))) { j++; closed = true; break; }
      }
      content.push(stripCols(cl, fe.indent));
      j++;
    }
    // a fenced block drops one trailing blank line before its closing
    // fence (b + 2 blank lines renders b\n\n, not b\n\n\n — cm-318)
    if (closed && content.length > 0 && content[content.length - 1].s === '') content.pop();
    const info = fe.info.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    const lang = (info.split(/[ \t]/)[0] || '');
    return { blocks: [{ t: 'code', fenced: true, lang: unescapeStr(lang), lines: content }], next: j };
  }
  const hb = htmlBlockStart(line, fns);
  if (hb && (!inPara || hb.type !== 7)) {
    const content = [line];
    let j = i + 1;
    let endNl = false;
    if (hb.type >= 1 && hb.type <= 5) {
      let closeIdx = -1;
      if (hb.endRe.test(line.s)) {
        closeIdx = i;
      } else {
        while (j < lines.length) {
          content.push(lines[j]);
          if (hb.endRe.test(lines[j].s)) { closeIdx = j; j++; break; }
          j++;
        }
      }
      if (closeIdx >= 0) {
        const next = lines[closeIdx + 1];
        // the closing line's newline is kept when the block is followed by
        // a non-empty line (cm-169 vs cm-183, cm-308) — a whitespace-only
        // line (spaces or a tab) still counts as non-empty here, so the
        // newline is kept (doc-15: a lone \t after --> keeps the \n);
        // only a truly empty line (or no next line) drops it
        if (!next) endNl = content[content.length - 1].last && content[content.length - 1].nl;
        else endNl = next.s.length > 0;
      } else {
        endNl = content[content.length - 1].last && content[content.length - 1].nl;
      }
    } else {
      while (j < lines.length && !isBlank(lines[j])) { content.push(lines[j]); j++; }
      if (j >= lines.length) endNl = content[content.length - 1].last && content[content.length - 1].nl;
      else endNl = false; // ended at a blank line: no trailing newline (cm-149, cm-155)
    }
    return { blocks: [{ t: 'html', lines: content, endNl }], next: j };
  }
  if (isThematicBreak(line, fns)) return { blocks: [{ t: 'hr' }], next: i + 1 };
  const lst = parseList(lines, i, refs, inPara, inItem);
  if (lst) return lst;
  if (relIndent(line, fns) <= 3 && line.s.charCodeAt(fns.idx) === 62) {
    const sub = [];
    let j = i;
    let inParaQ = false;
    let fence = null; // open fenced code block inside the quote
    while (j < lines.length) {
      const ql = lines[j];
      const qfns = firstNonSpace(ql);
      if (relIndent(ql, qfns) <= 3 && ql.s.charCodeAt(qfns.idx) === 62) {
        // strip '>' plus one optional space column; a tab there counts as
        // one column of the tab (cm-006)
        let l2 = { s: ql.s.slice(qfns.idx + 1), col: qfns.col + 1, last: ql.last, nl: ql.nl };
        const c0 = l2.s.charCodeAt(0);
        if (c0 === 32 || c0 === 9) l2 = stripColsExpand(l2, 1);
        sub.push(l2);
        // track fenced code blocks: lines inside a fence are code, not a
        // paragraph, so a lazy line after them must NOT continue the quote
        // (doc-01: a fence inside a quote must end before a bare line)
        if (fence) {
          if (isFenceClose(l2, fence.ch, fence.len)) fence = null;
          inParaQ = false;
        } else {
          const fe = fenceStart(l2, firstNonSpace(l2));
          if (fe) { fence = fe; inParaQ = false; }
          else inParaQ = tipIsPara(l2, inParaQ);
        }
        j++;
        continue;
      }
      // a blank line without '>' ends the quote (cm-242); it is not content
      if (isBlank(ql)) break;
      if (inParaQ && isLazyLine(ql)) { sub.push(lazyLine(ql)); j++; continue; }
      break;
    }
    const inner = parseBlocks(sub, refs, false);
    return { blocks: [{ t: 'quote', children: inner.blocks }], next: j };
  }
  if (!inPara && relIndent(line, fns) >= 4) {
    const content = [];
    let j = i;
    while (j < lines.length) {
      const cl = lines[j];
      if (isBlank(cl)) {
        let k = j + 1;
        while (k < lines.length && isBlank(lines[k])) k++;
        if (k < lines.length && relIndent(lines[k], firstNonSpace(lines[k])) >= 4) {
          while (j < k) { content.push(stripCols(lines[j], 4)); j++; }
          continue;
        }
        break;
      }
      const cfns = firstNonSpace(cl);
      if (relIndent(cl, cfns) < 4) break;
      content.push(stripCols(cl, 4));
      j++;
    }
    return { blocks: [{ t: 'code', fenced: false, lang: '', lines: content }], next: j };
  }
  return null;
}

function collectItem(lines, j, m) {
  const contentIndent = m.contentIndent;
  const base = lines[j].col || 0;
  const sub = [];
  // the first line's content starts at the content column, not at the first
  // non-space character: a tab straddling the column leaves spaces (cm-007,
  // cm-273, cm-274)
  const first = m.empty ? { s: '', col: base + contentIndent, last: lines[j].last, nl: lines[j].nl } : sliceAtCol(lines[j], base + contentIndent);
  sub.push(first);
  let contentSeen = first.s !== '';
  // track fenced code blocks: lines inside a fence are code, not a paragraph
  // (same lazy-line problem as in a quote — doc-01)
  let fence = null;
  // a fence captures a below-indent line as content ONLY once it already
  // has content: a below-indent FIRST line ends the fence (and the item)
  // instead — doc-17: the ```toml fence is empty because 'if my-package
  // previous' (indent 0) follows the opener directly, while ref8's
  // 'function f() {' (indent 0) is content because 'x' precedes it
  let fenceHasContent = false;
  let inPara;
  {
    const fe0 = fenceStart(first, firstNonSpace(first));
    if (fe0) { fence = fe0; fenceHasContent = false; inPara = false; }
    else inPara = tipIsPara(first, false);
  }
  let k = j + 1;
  while (k < lines.length) {
    const line = lines[k];
    if (isBlank(line)) {
      // an empty item ends at the first blank line before any content (cm-280)
      if (!contentSeen) break;
      // A blank line belongs to this item only if the next non-blank line
      // is also part of it (indented to the content indent). Otherwise the
      // blank is a separator at the outer level and must not be swallowed:
      // after a blank the paragraph is closed, so a lazy continuation is
      // impossible (cm-325: the blank between a nested list and baz makes
      // the outer list loose).
      let q = k + 1;
      while (q < lines.length && isBlank(lines[q])) q++;
      if (q < lines.length) {
        const nfns = firstNonSpace(lines[q]);
        if (relIndent(lines[q], nfns) < contentIndent) break;
      }
      sub.push({ s: '', col: line.col || 0, last: line.last, nl: line.nl });
      inPara = false;
      k++;
      continue;
    }
    const fns = firstNonSpace(line);
    if (relIndent(line, fns) >= contentIndent) {
      sub.push(stripColsExpand(line, contentIndent));
      contentSeen = true;
      const last = sub[sub.length - 1];
      if (fence) {
        if (isFenceClose(last, fence.ch, fence.len)) fence = null;
        else fenceHasContent = true;
        inPara = false;
      } else {
        const fe = fenceStart(last, firstNonSpace(last));
        if (fe) { fence = fe; fenceHasContent = false; inPara = false; }
        else inPara = tipIsPara(last, inPara);
      }
      k++;
      continue;
    }
    const mk = parseListMarker(line);
    // a marker below this item's content indent, of the same type, is a
    // sibling item (cm-295/310/311/312/313) — end this item here
    if (mk && mk.markerCol < m.contentIndent && mk.ordered === m.ordered && (m.ordered ? mk.delim === m.delim : mk.bullet === m.bullet)) break;
    if (inPara && isLazyLine(line)) {
      sub.push(lazyLine(line));
      contentSeen = true;
      inPara = true;
      k++;
      continue;
    }
    // Inside an open fenced code block, a line below the content indent is
    // still fence content (the fence captures lines until its closing
    // fence), not the end of the item — ref8: 'function f() {' at indent 0
    // belongs to the ```css block inside the list item — but ONLY once the
    // fence already has content (doc-17: a below-indent first line ends
    // the fence empty instead).
    if (fence) {
      if (!fenceHasContent) break;
      sub.push(line);
      contentSeen = true;
      inPara = false;
      k++;
      continue;
    }
    break;
  }
  // trailing blank lines of the item, not counting an empty item's own line
  let tb = 0;
  for (let q = sub.length - 1; q >= 1 && sub[q].s === ''; q--) tb++;
  return { sub, next: k, trailingBlanks: tb };
}

function parseList(lines, i, refs, inPara, inItem) {
  const first = parseListMarker(lines[i]);
  if (!first) return null;
  // A list can interrupt a paragraph only with a non-empty item, and an
  // ordered list only when it starts at 1 (cm-285/304/367) — EXCEPT inside
  // a list item's content, where an ordered marker at the content indent
  // always starts a sublist regardless of its start number (doc-01/02:
  // '49.' and '505791.' inside an item start <ol start="49">).
  if (inPara && !inItem && (first.empty || (first.ordered && first.start !== 1))) return null;
  if (inPara && inItem && first.empty) return null;
  const ordered = first.ordered;
  const key = ordered ? first.delim : first.bullet;
  const items = [];
  let j = i;
  let loose = false;
  let prevContentIndent = first.contentIndent;
  while (j < lines.length) {
    // blank lines between items do not end the list: skip them, look ahead
    // for a sibling item (cm-315); a blank line before it makes it loose
    let k = j;
    while (k < lines.length && isBlank(lines[k])) k++;
    if (k > j) {
      const nm = k < lines.length ? parseListMarker(lines[k]) : null;
      if (nm && nm.ordered === ordered && (ordered ? nm.delim === key : nm.bullet === key) && nm.markerCol < prevContentIndent) {
        loose = true;
        j = k;
      } else {
        break;
      }
    }
    // a thematic break is not a list item (cm-060)
    const fns = firstNonSpace(lines[j]);
    if (isThematicBreak(lines[j], fns)) break;
    const m = parseListMarker(lines[j]);
    // a sibling item has a marker indent below the previous item's content
    // indent (markers at 0-3 can all be siblings — cm-295/310/311/312/313)
    if (!m || m.ordered !== ordered || (ordered ? m.delim !== key : m.bullet !== key) || m.markerCol >= prevContentIndent) break;
    const it = collectItem(lines, j, m);
    const inner = parseBlocks(it.sub, refs, true);
    if (inner.blankBetween) loose = true;
    items.push(inner.blocks);
    prevContentIndent = m.contentIndent;
    j = it.next;
    if (it.trailingBlanks > 0) {
      const nm = j < lines.length ? parseListMarker(lines[j]) : null;
      if (nm && nm.ordered === ordered && (ordered ? nm.delim === key : nm.bullet === key) && nm.markerCol < prevContentIndent) loose = true;
    }
  }
  if (items.length === 0) return null;
  return { blocks: [{ t: 'list', ordered, start: first.start, tight: !loose, items }], next: j };
}

// ---------- rendering ----------
function codeText(codeLines, endsWithNewline) {
  let out = '';
  for (const l of codeLines) out += l.s + ((l.last && !endsWithNewline) ? '' : '\n');
  return out;
}
function htmlText(htmlLines, endNl) {
  let out = htmlLines.map((l) => l.s).join('\n');
  if (endNl) out += '\n';
  return out;
}
function renderBlocks(blocks, refs, tight, endsWithNewline) {
  let out = '';
  for (const b of blocks) {
    if (b.t === 'para') {
      const inner = renderInline(parseInline(b.text, refs));
      const box = b.task ? (b.task === 'checked' ? '<input checked="" disabled="" type="checkbox">' : '<input disabled="" type="checkbox">') : '';
      out += tight ? box + inner : '<p>' + box + inner + '</p>\n';
    } else if (b.t === 'heading') {
      out += '<h' + b.level + '>' + renderInline(parseInline(b.text, refs)) + '</h' + b.level + '>\n';
    } else if (b.t === 'code') {
      out += '<pre><code' + (b.lang ? ' class="language-' + esc(b.lang, false) + '"' : '') + '>' + esc(codeText(b.lines, endsWithNewline), true) + '</code></pre>\n';
    } else if (b.t === 'html') {
      out += htmlText(b.lines, b.endNl);
    } else if (b.t === 'hr') {
      out += '<hr>\n';
    } else if (b.t === 'quote') {
      out += '<blockquote>\n' + renderBlocks(b.children, refs, false, endsWithNewline) + '</blockquote>\n';
    } else if (b.t === 'list') {
      out += b.ordered ? '<ol' + (b.start !== 1 ? ' start="' + b.start + '"' : '') + '>\n' : '<ul>\n';
      for (const item of b.items) {
        // task list: [ ] / [x] / [X] at the start of the item's first
        // paragraph (gfm-279/280)
        let it = item;
        if (item.length > 0 && item[0].t === 'para') {
          const text = item[0].text;
          if (text.length >= 3 && text.charCodeAt(0) === 91) {
            const m = text.charCodeAt(1);
            if ((m === 32 || m === 120 || m === 88) && text.charCodeAt(2) === 93 && (text.length === 3 || text.charCodeAt(3) === 32 || text.charCodeAt(3) === 9)) {
              const first = { ...item[0], text: text.slice(3), task: (m === 120 || m === 88) ? 'checked' : 'unchecked' };
              it = [first, ...item.slice(1)];
            }
          }
        }
        out += '<li>' + renderBlocks(it, refs, b.tight, endsWithNewline) + '</li>\n';
      }
      out += b.ordered ? '</ol>\n' : '</ul>\n';
    } else if (b.t === 'table') {
      const alName = (a) => (a === 1 ? 'left' : a === 2 ? 'center' : a === 3 ? 'right' : '');
      out += '<table>\n<thead>\n<tr>\n';
      for (let k = 0; k < b.header.length; k++) {
        const al = alName(b.align[k]);
        out += '<th' + (al ? ' align="' + al + '"' : '') + '>' + renderInline(parseInline(b.header[k], refs)) + '</th>\n';
      }
      out += '</tr>\n</thead>\n';
      if (b.rows.length > 0) {
        out += '<tbody>';
        for (const row of b.rows) {
          out += '<tr>\n';
          for (let k = 0; k < row.length; k++) {
            const al = alName(b.align[k]);
            out += '<td' + (al ? ' align="' + al + '"' : '') + '>' + renderInline(parseInline(row[k], refs)) + '</td>\n';
          }
          out += '</tr>\n';
        }
        out += '</tbody>';
      }
      out += '</table>\n';
    }
  }
  return out;
}

export function parse(markdown) {
  extAutolinkOff = false;
  const src = String(markdown).replace(/\r\n?/g, '\n');
  const endsWithNewline = src.endsWith('\n');
  const rawLines = src.split('\n');
  if (endsWithNewline) rawLines.pop();
  const lines = rawLines.map((s, idx) => ({ s, last: idx === rawLines.length - 1, col: 0, nl: idx < rawLines.length - 1 || endsWithNewline }));
  const refs = new Map();
  const { blocks } = parseBlocks(lines, refs, false);
  return renderBlocks(blocks, refs, false, endsWithNewline);
}
export default parse;
