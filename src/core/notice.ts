/**
 * The data notice (R37): the text lives in docs/NOTICE.md — the source of truth, approved by
 * the owner — and is read from there at build time; this module only takes it apart for the
 * screen. No imports: the Worker reaches NOTICE_VERSION through this file.
 */

/**
 * Version of the notice the app shows; written to consents with every agreement, and the
 * server accepts no other. A new text in docs/NOTICE.md means a new version and new consent
 * (STAGE6_RESEARCH 8.5): change both together (a test checks the version line of the text).
 */
export const NOTICE_VERSION = 2;

export type NoticeLang = 'tg' | 'ru' | 'en';

/** A run of text: bold, or a link (the contact address, the authority's site). */
export interface Inline {
  text: string;
  bold?: true;
  href?: string;
}

export type NoticeBlock =
  | { kind: 'p'; inline: Inline[] }
  /**
   * "– item" lines; "· sub-item" lines under an item (version 2: what is stored, in detail) go
   * to `sub` at the same index (absent or empty — none).
   */
  | { kind: 'list'; items: Inline[][]; sub?: Inline[][][] }
  /** "Your name: [field]" — a text field with this label. */
  | { kind: 'field'; label: string }
  /** "☐ I am a parent…" — a checkbox with this label. */
  | { kind: 'check'; label: string };

export interface NoticeSection {
  title: string;
  blocks: NoticeBlock[];
}

/** The notice itself and the screen for a parent or guardian, in one language. */
export interface NoticeText {
  notice: NoticeSection;
  parent: NoticeSection;
}

const LINK = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+|cnpd\.public\.lu)/;

function links(text: string, bold: boolean): Inline[] {
  const out: Inline[] = [];
  text.split(LINK).forEach((part, i) => {
    if (part === '') return;
    const run: Inline = { text: part };
    if (bold) run.bold = true;
    if (i % 2 === 1) run.href = part.includes('@') ? `mailto:${part}` : `https://${part}`;
    out.push(run);
  });
  return out;
}

/** Markdown of one line: **bold** and the two kinds of links, nothing else. */
export function inline(line: string): Inline[] {
  return line.split('**').flatMap((part, i) => links(part, i % 2 === 1));
}

const ITEM = /^[–-]\s+/;
const SUB = /^·\s+/;
const FIELD = /^(.*?):\s*\[[^\]]+\]\s*$/;
const CHECK = /^☐\s*(.*)$/;

/** Item lines, each perhaps followed by its sub-item lines, as one list block. */
function list(lines: string[]): NoticeBlock {
  const items: Inline[][] = [];
  const sub: Inline[][][] = [];
  for (const line of lines) {
    if (SUB.test(line)) sub[items.length - 1]!.push(inline(line.replace(SUB, '')));
    else {
      items.push(inline(line.replace(ITEM, '')));
      sub.push([]);
    }
  }
  return sub.some((s) => s.length > 0) ? { kind: 'list', items, sub } : { kind: 'list', items };
}

/** A run of list lines: it starts with an item, then items and their sub-items. */
const isList = (lines: string[]) => lines.length > 0 && ITEM.test(lines[0]!) && lines.every((l) => ITEM.test(l) || SUB.test(l));

function blocks(lines: string[]): NoticeBlock[] {
  const out: NoticeBlock[] = [];
  let group: string[] = [];
  const flush = () => {
    if (group.length === 0) return;
    const [first = '', ...rest] = group;
    if (isList(group)) {
      out.push(list(group));
    } else if (isList(rest)) {
      out.push({ kind: 'p', inline: inline(first) });
      out.push(list(rest));
    } else {
      for (const line of group) {
        const field = FIELD.exec(line);
        const check = CHECK.exec(line);
        if (field) out.push({ kind: 'field', label: field[1]!.trim() });
        else if (check) out.push({ kind: 'check', label: check[1]!.trim() });
        else out.push({ kind: 'p', inline: inline(line) });
      }
    }
    group = [];
  };
  for (const line of lines) {
    if (line.trim() === '' || line.trim() === '---') flush();
    else group.push(line.trim());
  }
  flush();
  return out;
}

/**
 * docs/NOTICE.md → the texts of one language: the part under "## <lang>", split by its
 * two "### " headings. Everything before "## tg" (the preamble for the project) is skipped.
 */
export function parseNotice(md: string, lang: NoticeLang): NoticeText {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${lang}`);
  if (start < 0) throw new Error(`notice: no section ${lang}`);
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  const sections: NoticeSection[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of lines.slice(start + 1, end)) {
    if (line.startsWith('### ')) {
      if (current) sections.push({ title: current.title, blocks: blocks(current.lines) });
      current = { title: line.slice(4).trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push({ title: current.title, blocks: blocks(current.lines) });
  const [notice, parent] = sections;
  if (!notice || !parent || sections.length !== 2) throw new Error(`notice: ${lang} needs two ### sections`);
  return { notice, parent };
}
