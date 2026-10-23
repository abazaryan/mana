import type { Inline, NoticeBlock, NoticeSection } from '../core/notice';

function Runs({ runs }: { runs: Inline[] }) {
  return (
    <>
      {runs.map((run, i) => {
        const text = run.href ? (
          <a href={run.href} target="_blank" rel="noopener noreferrer">
            {run.text}
          </a>
        ) : (
          run.text
        );
        return run.bold ? <strong key={i}>{text}</strong> : <span key={i}>{text}</span>;
      })}
    </>
  );
}

/** Paragraphs and lists of a notice section; fields and checkboxes are left to the caller. */
export function NoticeBlocks({ blocks }: { blocks: NoticeBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === 'p') {
          return (
            <p key={i}>
              <Runs runs={block.inline} />
            </p>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={i}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <Runs runs={item} />
                </li>
              ))}
            </ul>
          );
        }
        return null;
      })}
    </>
  );
}

/** The data notice (docs/NOTICE.md) as a page: title, version line, sections. */
export function NoticeView({ section }: { section: NoticeSection }) {
  const [version, ...rest] = section.blocks;
  return (
    <article className="notice">
      <h1>{section.title}</h1>
      {version?.kind === 'p' && (
        <p className="m">
          <Runs runs={version.inline} />
        </p>
      )}
      <NoticeBlocks blocks={version?.kind === 'p' ? rest : section.blocks} />
    </article>
  );
}
