import { describe, expect, it } from 'vitest';
import markdown from '../../docs/NOTICE.md?raw';
import { inline, NOTICE_VERSION, parseNotice, type NoticeBlock, type NoticeLang } from './notice';

const LANGS: NoticeLang[] = ['tg', 'ru', 'en'];
const text = (blocks: NoticeBlock[]) =>
  blocks
    .map((b) => (b.kind === 'p' ? b.inline.map((r) => r.text).join('') : b.kind === 'list' ? b.items.map((i) => i.map((r) => r.text).join('')).join('\n') : b.label))
    .join('\n');

describe('docs/NOTICE.md — the approved notice, read at build time', () => {
  it.each(LANGS)('%s: the notice and the parent screen', (lang) => {
    const { notice, parent } = parseNotice(markdown, lang);
    expect(notice.title.length).toBeGreaterThan(0);
    expect(parent.title.length).toBeGreaterThan(0);
    expect(notice.blocks.filter((b) => b.kind === 'list').length).toBeGreaterThanOrEqual(2);
    expect(parent.blocks.filter((b) => b.kind === 'field')).toHaveLength(1);
    expect(parent.blocks.filter((b) => b.kind === 'check')).toHaveLength(1);
  });

  it.each(LANGS)('%s: the version line names NOTICE_VERSION (a new text needs a new version)', (lang) => {
    const [first] = parseNotice(markdown, lang).notice.blocks;
    expect(first?.kind).toBe('p');
    const line = first?.kind === 'p' ? first.inline.map((r) => r.text).join('') : '';
    expect(line).toMatch(new RegExp(`\\D${NOTICE_VERSION} · `));
  });

  it.each(LANGS)('%s: the contact address and the authority are links', (lang) => {
    const { notice, parent } = parseNotice(markdown, lang);
    const runs = [...notice.blocks, ...parent.blocks].flatMap((b) => (b.kind === 'p' ? b.inline : b.kind === 'list' ? b.items.flat() : []));
    const hrefs = new Set(runs.map((r) => r.href).filter(Boolean));
    expect(hrefs).toEqual(new Set(['mailto:pooyadev@protonmail.com', 'https://cnpd.public.lu']));
  });

  it('the preamble for the project is not shown', () => {
    for (const lang of LANGS) expect(text(parseNotice(markdown, lang).notice.blocks)).not.toContain('auth_attempts');
  });

  it('the header of the file names the same version', () => {
    expect(markdown.split('\n')[0]).toMatch(new RegExp(`\\s${NOTICE_VERSION} \\(`));
  });
});

describe('inline markdown', () => {
  it('bold, and links without the sentence’s full stop', () => {
    expect(inline('**Why.** Write to a@b.com. See cnpd.public.lu)')).toEqual([
      { text: 'Why.', bold: true },
      { text: ' Write to ' },
      { text: 'a@b.com', href: 'mailto:a@b.com' },
      { text: '. See ' },
      { text: 'cnpd.public.lu', href: 'https://cnpd.public.lu' },
      { text: ')' },
    ]);
  });

  it('a missing language or section is an error, not an empty screen', () => {
    expect(() => parseNotice('## tg\n### Only one\ntext', 'tg')).toThrow();
    expect(() => parseNotice('## ru\n### A\n### B', 'tg')).toThrow();
  });
});
