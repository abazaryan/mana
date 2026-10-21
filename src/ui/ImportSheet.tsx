import type { DeckArchive } from '../core/deckArchive';
import { deckTitle, type DeckIssue } from '../core/deckFormat';
import type { ImportConfirm, ImportPlan } from '../core/deckImport';
import { reportForAi } from '../core/deckReport';
import { CopyButton } from './CopyButton';
import { languageName } from './DecksScreen';
import { useI18n } from './i18n';
import { Sheet } from './Sheet';

/** Check results of one deck: errors refuse it, warnings need "Add anyway", notes only inform (Р33 п. 15). */
export interface Checked {
  deckId: string | null;
  revision: number | null;
  errors: DeckIssue[];
  warnings: DeckIssue[];
  notes: DeckIssue[];
}

export type ImportState =
  | { phase: 'reading' }
  | { phase: 'rejected'; checked: Checked }
  | { phase: 'confirm'; plan: ImportPlan; archive: DeckArchive; checked: Checked }
  | { phase: 'done'; plan: ImportPlan; checked: Checked }
  | { phase: 'failed'; error: string };

interface Props {
  state: ImportState;
  onConfirm(plan: ImportPlan, archive: DeckArchive): void;
  onClose(): void;
}

function Issues({ items }: { items: DeckIssue[] }) {
  return (
    <ul className="issues" lang="ru">
      {items.map((i, k) => (
        <li key={k}>{i.message}</li>
      ))}
    </ul>
  );
}

function Listed({ items, label, open = false }: { items: DeckIssue[]; label: string; open?: boolean }) {
  if (items.length === 0) return null;
  return (
    <details className="mt" open={open}>
      <summary>{label}</summary>
      <Issues items={items} />
    </details>
  );
}

/** Warnings and notes, and the report for the AI when there is something to fix. */
function Findings({ checked, openWarnings = false }: { checked: Checked; openWarnings?: boolean }) {
  const { t } = useI18n();
  const fix = checked.errors.length + checked.warnings.length > 0;
  return (
    <>
      <Listed items={checked.warnings} label={t('import.warnings', { n: checked.warnings.length })} open={openWarnings} />
      <Listed items={checked.notes} label={t('import.notes', { n: checked.notes.length })} />
      {fix && (
        <div className="mt">
          <CopyButton label={t('import.copyReport')} text={() => reportForAi(checked)} />
        </div>
      )}
    </>
  );
}

function ConfirmText({ c, plan }: { c: ImportConfirm; plan: ImportPlan }) {
  const { t, lang } = useI18n();
  switch (c.type) {
    case 'reinstall':
      return <p>{t('import.reinstall', { rev: c.revision })}</p>;
    case 'older':
      return <p>{t('import.older', { incoming: c.incoming, installed: c.installed })}</p>;
    case 'different':
      return (
        <>
          <p>{t('import.different', { name: deckTitle({ name: c.installedName, title: c.installedTitle }, lang), shared: c.shared, installed: c.installedCount })}</p>
          {c.languageChanged && (
            <p>{t('import.languageChanged', {
                from: languageName(c.installedLanguage, lang),
                to: languageName(plan.deck.language, lang),
              })}</p>
          )}
        </>
      );
  }
}

export function ImportSheet({ state, onConfirm, onClose }: Props) {
  const { t, lang } = useI18n();
  const close = state.phase === 'reading' ? () => {} : onClose;

  if (state.phase === 'reading') {
    return (
      <Sheet title={t('decks.import')} onClose={close} closeLabel={t('common.close')}>
        <p className="lead" aria-live="polite">
          {t('import.reading')}
        </p>
      </Sheet>
    );
  }
  if (state.phase === 'rejected') {
    return (
      <Sheet title={t('import.rejected')} onClose={onClose} closeLabel={t('common.close')}>
        <p className="hint">{t('import.authorNote')}</p>
        <Issues items={state.checked.errors} />
        <Findings checked={state.checked} />
      </Sheet>
    );
  }
  if (state.phase === 'confirm') {
    const { plan, archive, checked } = state;
    const warned = checked.warnings.length > 0;
    return (
      <Sheet title={t('import.confirmTitle')} onClose={onClose} closeLabel={t('common.close')}>
        <p>
          <strong>{deckTitle(plan.deck, lang)}</strong>
        </p>
        {plan.confirm.map((c, k) => (
          <ConfirmText key={k} c={c} plan={plan} />
        ))}
        {warned && <p className="hint">{t('import.fixFirst')}</p>}
        <Findings checked={checked} openWarnings />
        <div className="row mt">
          <button className="secondary" type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="primary" type="button" onClick={() => onConfirm(plan, archive)}>
            {warned ? t('study.addAnyway') : t('import.install')}
          </button>
        </div>
      </Sheet>
    );
  }
  if (state.phase === 'done') {
    const { plan } = state;
    return (
      <Sheet
        title={t(plan.kind === 'install' ? 'import.installed' : 'import.updated')}
        onClose={onClose}
        closeLabel={t('common.close')}
      >
        <p>
          <strong>{deckTitle(plan.deck, lang)}</strong>
        </p>
        <p>{t('import.summary', { ...plan.summary })}</p>
        <Findings checked={state.checked} />
      </Sheet>
    );
  }
  return (
    <Sheet title={t('import.rejected')} onClose={onClose} closeLabel={t('common.close')}>
      <p className="hint err">{t('import.failed', { error: state.error })}</p>
    </Sheet>
  );
}
