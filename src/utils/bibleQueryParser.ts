// Bible Query Parser
// Parses KJVCanOpener-style search expressions into an AST.
//
// Supported syntax:
//   love                      — single word (case-insensitive substring match)
//   "the love of God"         — exact phrase (consecutive words)
//   love|charity              — OR: matches "love" OR "charity"
//   the Lord|God              — OR: matches "the Lord" OR "God"
//   lov*                      — wildcard: any word starting with "lov"
//   l?ve                      — wildcard: any 4-letter word l_ve
//   l[ai]ve                   — wildcard: "live" or "lave"
//   -Satan                    — exclude: verses containing this are removed
//   the * of God              — "*" as "any word" placeholder
//
// Multiple terms (space-separated, not quoted) are AND'd together at the verse level.

// ─── AST Node Types ──────────────────────────────────────────────────────────

export type QueryNode =
  | { type: 'word'; value: string }
  | { type: 'wildcard'; regex: RegExp; pattern: string }
  | { type: 'anyWord' }
  | { type: 'phrase'; words: QueryNode[] }
  | { type: 'or'; alternatives: QueryNode[] }
  | { type: 'exclude'; node: QueryNode };

export interface ParsedQuery {
  /** Terms that must match (AND'd together) */
  include: QueryNode[];
  /** Terms that must NOT match (excluded verses are removed) */
  exclude: QueryNode[];
}

// ─── Wildcard → RegExp conversion ────────────────────────────────────────────
// Mirrors Qt's wildcardToRegularExpression: * → .*, ? → ., [...] preserved.

export function wildcardToRegex(pattern: string): RegExp {
  let re = '';
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (inClass) {
      re += ch;
      if (ch === ']') inClass = false;
      continue;
    }
    switch (ch) {
      case '*':
        re += '.*';
        break;
      case '?':
        re += '.';
        break;
      case '[':
        re += '[';
        inClass = true;
        // If the class starts with '!' or '^', Qt inverts — convert to '^'
        if (pattern[i + 1] === '!' || pattern[i + 1] === '^') {
          re += '^';
          i++;
        }
        break;
      case '.':
      case '+':
      case '(':
      case ')':
      case '{':
      case '}':
      case '^':
      case '$':
      case '|':
      case '\\':
        re += '\\' + ch;
        break;
      default:
        re += ch;
    }
  }
  return new RegExp('^' + re + '$', 'i');
}

export function hasWildcardChars(word: string): boolean {
  return /[*?\[\]]/.test(word);
}

// ─── Tokenizer ───────────────────────────────────────────────────────────────

type Token =
  | { kind: 'word'; value: string; exclude: boolean }
  | { kind: 'pipe' }
  | { kind: 'star' }
  | { kind: 'phraseStart' }
  | { kind: 'phraseEnd' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Skip whitespace (separates terms)
    if (/\s/.test(ch)) { i++; continue; }

    // Quoted phrase: "..."
    if (ch === '"') {
      tokens.push({ kind: 'phraseStart' });
      i++;
      let word = '';
      while (i < len && input[i] !== '"') {
        if (/\s/.test(input[i])) {
          if (word) {
            if (word === '*') tokens.push({ kind: 'star' });
            else tokens.push({ kind: 'word', value: word, exclude: false });
            word = '';
          }
        } else {
          word += input[i];
        }
        i++;
      }
      if (word) {
        if (word === '*') tokens.push({ kind: 'star' });
        else tokens.push({ kind: 'word', value: word, exclude: false });
      }
      i++; // skip closing "
      tokens.push({ kind: 'phraseEnd' });
      continue;
    }

    // Pipe (OR operator)
    if (ch === '|') {
      tokens.push({ kind: 'pipe' });
      i++;
      continue;
    }

    // Exclude prefix: -word or -"phrase"
    if (ch === '-' && i + 1 < len && input[i + 1] !== ' ' && input[i + 1] !== '|') {
      // Check if it's a quoted phrase after -
      if (input[i + 1] === '"') {
        // Consume the - and let the phrase be tokenized, then mark exclude
        i++; // skip -
        const phraseStartIdx = tokens.length;
        tokens.push({ kind: 'phraseStart' });
        i++; // skip opening "
        let word = '';
        while (i < len && input[i] !== '"') {
          if (/\s/.test(input[i]) && word) {
            tokens.push({ kind: 'word', value: word, exclude: false });
            word = '';
          } else if (!/\s/.test(input[i])) {
            word += input[i];
          }
          i++;
        }
        if (word) tokens.push({ kind: 'word', value: word, exclude: false });
        i++; // skip closing "
        tokens.push({ kind: 'phraseEnd' });
        // Mark all words in this phrase as excluded
        for (let t = phraseStartIdx; t < tokens.length; t++) {
          if (tokens[t].kind === 'word') (tokens[t] as { kind: 'word'; value: string; exclude: boolean }).exclude = true;
        }
        continue;
      }
      // Regular -word
      i++; // skip -
      let word = '';
      while (i < len && !/\s/.test(input[i]) && input[i] !== '|' && input[i] !== '"') {
        word += input[i];
        i++;
      }
      if (word) tokens.push({ kind: 'word', value: word, exclude: true });
      continue;
    }

    // Star as standalone word (* = any word placeholder)
    if (ch === '*' && (i + 1 >= len || /\s/.test(input[i + 1]) || input[i + 1] === '|')) {
      tokens.push({ kind: 'star' });
      i++;
      continue;
    }

    // Regular word
    let word = '';
    while (i < len && !/\s/.test(input[i]) && input[i] !== '|' && input[i] !== '"') {
      word += input[i];
      i++;
    }
    if (word) {
      // Check if word is just "*" → any word
      if (word === '*') {
        tokens.push({ kind: 'star' });
      } else {
        tokens.push({ kind: 'word', value: word, exclude: false });
      }
    }
  }

  return tokens;
}

// ─── Parser: Token[] → ParsedQuery ───────────────────────────────────────────

function makeWordNode(value: string): QueryNode {
  // Strip leading/trailing punctuation from the search term
  const cleaned = value.replace(/^[^\w*?\[]+|[^\w*?\]]+$/g, '');
  if (!cleaned) return { type: 'word', value: value.toLowerCase() };
  if (hasWildcardChars(cleaned)) {
    return { type: 'wildcard', regex: wildcardToRegex(cleaned), pattern: cleaned };
  }
  return { type: 'word', value: cleaned.toLowerCase() };
}

export function parseBibleQuery(input: string): ParsedQuery {
  const tokens = tokenize(input);
  const include: QueryNode[] = [];
  const exclude: QueryNode[] = [];

  let i = 0;
  while (i < tokens.length) {
    // Skip stray pipes
    if (tokens[i].kind === 'pipe') { i++; continue; }

    // Collect a "group" = one or more terms connected by |
    // Each "term" is either: a word, a star, or a phrase (phraseStart ... phraseEnd)
    const groupTerms: QueryNode[] = [];
    let groupIsExclude = false;

    while (i < tokens.length) {
      const tok = tokens[i];

      if (tok.kind === 'pipe') {
        i++; // consume pipe, continue collecting alternatives
        continue;
      }

      if (tok.kind === 'word') {
        if (tok.exclude) groupIsExclude = true;
        groupTerms.push(makeWordNode(tok.value));
        i++;
      } else if (tok.kind === 'star') {
        groupTerms.push({ type: 'anyWord' });
        i++;
      } else if (tok.kind === 'phraseStart') {
        // Collect all tokens until phraseEnd
        i++; // skip phraseStart
        const phraseWords: QueryNode[] = [];
        while (i < tokens.length && tokens[i].kind !== 'phraseEnd') {
          if (tokens[i].kind === 'word') {
            const wt = tokens[i] as { kind: 'word'; value: string; exclude: boolean };
            if (wt.exclude) groupIsExclude = true;
            phraseWords.push(makeWordNode(wt.value));
          } else if (tokens[i].kind === 'star') {
            phraseWords.push({ type: 'anyWord' });
          }
          i++;
        }
        if (i < tokens.length) i++; // skip phraseEnd
        if (phraseWords.length === 1) {
          groupTerms.push(phraseWords[0]);
        } else if (phraseWords.length > 1) {
          groupTerms.push({ type: 'phrase', words: phraseWords });
        }
      } else if (tok.kind === 'phraseEnd') {
        // Stray phraseEnd — skip
        i++;
      } else {
        i++;
      }

      // Check if next token is a pipe (continue the OR group) or not (end group)
      if (i >= tokens.length || tokens[i].kind !== 'pipe') break;
    }

    // Add the group to the appropriate list
    if (groupTerms.length === 0) continue;

    const node: QueryNode = groupTerms.length === 1
      ? groupTerms[0]
      : { type: 'or', alternatives: groupTerms };

    if (groupIsExclude) {
      exclude.push(node);
    } else {
      // Skip standalone anyWord as an include term (always matches, meaningless)
      if (!(node.type === 'anyWord')) {
        include.push(node);
      }
    }
  }

  return { include, exclude };
}

// ─── Helpers for the evaluator ───────────────────────────────────────────────

/** Check if a single word matches a QueryNode (word or wildcard). */
export function matchWord(word: string, node: QueryNode): boolean {
  const lower = word.toLowerCase();
  switch (node.type) {
    case 'word':
      return lower === node.value;
    case 'wildcard':
      return node.regex.test(word);
    case 'anyWord':
      return true;
    default:
      return false;
  }
}

/** Tokenize a verse's text into lowercase words. */
export function verseWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}