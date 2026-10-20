// BERT uncased WordPiece tokenizer, a dependency-free port of Hugging Face's
// BertTokenizer (BasicTokenizer + WordpieceTokenizer) with do_lower_case=true.
// Works in the browser and in Node, so the offline embedding script and the
// site produce identical token ids.

const CLS = '[CLS]';
const SEP = '[SEP]';
const UNK = '[UNK]';
const PAD = '[PAD]';
const MAX_CHARS_PER_WORD = 100;

function isWhitespace(ch) {
  if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') return true;
  return /\p{Zs}/u.test(ch);
}

function isControl(ch) {
  if (ch === '\t' || ch === '\n' || ch === '\r') return false;
  return /\p{Cc}|\p{Cf}/u.test(ch);
}

function isPunctuation(ch) {
  const cp = ch.codePointAt(0);
  // BERT treats every non-alphanumeric ASCII symbol as punctuation.
  if ((cp >= 33 && cp <= 47) || (cp >= 58 && cp <= 64) ||
      (cp >= 91 && cp <= 96) || (cp >= 123 && cp <= 126)) return true;
  return /\p{P}/u.test(ch);
}

function isChineseChar(cp) {
  return (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) ||
    (cp >= 0x20000 && cp <= 0x2A6DF) || (cp >= 0x2A700 && cp <= 0x2B73F) ||
    (cp >= 0x2B740 && cp <= 0x2B81F) || (cp >= 0x2B820 && cp <= 0x2CEAF) ||
    (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0x2F800 && cp <= 0x2FA1F);
}

function cleanText(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === 0 || cp === 0xFFFD || isControl(ch)) continue;
    out += isWhitespace(ch) ? ' ' : ch;
  }
  return out;
}

function padChineseChars(text) {
  let out = '';
  for (const ch of text) {
    out += isChineseChar(ch.codePointAt(0)) ? ` ${ch} ` : ch;
  }
  return out;
}

function stripAccents(text) {
  return text.normalize('NFD').replace(/\p{Mn}/gu, '');
}

function splitOnPunctuation(word) {
  const pieces = [];
  let current = '';
  for (const ch of word) {
    if (isPunctuation(ch)) {
      if (current) pieces.push(current);
      pieces.push(ch);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function basicTokenize(text) {
  text = padChineseChars(cleanText(text));
  const tokens = [];
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue;
    const normalized = stripAccents(word.toLowerCase());
    tokens.push(...splitOnPunctuation(normalized));
  }
  return tokens;
}

export class WordPieceTokenizer {
  constructor(vocabText) {
    this.vocab = new Map();
    vocabText.split('\n').forEach((line, i) => {
      const token = line.replace(/\r$/, '');
      if (token || i === 0) this.vocab.set(token, i);
    });
    this.clsId = this.vocab.get(CLS);
    this.sepId = this.vocab.get(SEP);
    this.unkId = this.vocab.get(UNK);
    this.padId = this.vocab.get(PAD);
  }

  static async fromUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`vocab fetch failed: ${res.status}`);
    return new WordPieceTokenizer(await res.text());
  }

  wordpiece(word) {
    const chars = Array.from(word);
    if (chars.length > MAX_CHARS_PER_WORD) return [UNK];
    const pieces = [];
    let start = 0;
    while (start < chars.length) {
      let end = chars.length;
      let match = null;
      while (start < end) {
        let sub = chars.slice(start, end).join('');
        if (start > 0) sub = '##' + sub;
        if (this.vocab.has(sub)) { match = sub; break; }
        end -= 1;
      }
      if (match === null) return [UNK];
      pieces.push(match);
      start = end;
    }
    return pieces;
  }

  tokenize(text) {
    return basicTokenize(text).flatMap((w) => this.wordpiece(w));
  }

  // Returns BigInt64Arrays ready for onnxruntime, truncated to maxLength
  // including [CLS] and [SEP].
  encode(text, maxLength = 128) {
    const ids = this.tokenize(text)
      .slice(0, maxLength - 2)
      .map((t) => this.vocab.get(t) ?? this.unkId);
    const all = [this.clsId, ...ids, this.sepId];
    return {
      tokens: all,
      inputIds: BigInt64Array.from(all, BigInt),
      attentionMask: BigInt64Array.from(all, () => 1n),
      tokenTypeIds: BigInt64Array.from(all, () => 0n),
    };
  }
}
