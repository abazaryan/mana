/**
 * The approved data notice, read from docs/NOTICE.md at build time (R37 item 1): one source of
 * truth, no second copy in the code.
 */
import markdown from '../../docs/NOTICE.md?raw';
import { parseNotice, type NoticeLang, type NoticeText } from '../core/notice';

const cache = new Map<NoticeLang, NoticeText>();

export function noticeText(lang: NoticeLang): NoticeText {
  let text = cache.get(lang);
  if (!text) {
    text = parseNotice(markdown, lang);
    cache.set(lang, text);
  }
  return text;
}
