import { useState } from 'react';
import { cleanTypedName, PARENT_NAME_MAX, type Consent } from '../core/auth';
import { NOTICE_VERSION, type NoticeSection } from '../core/notice';
import { useI18n } from './i18n';
import { NoticeBlocks } from './NoticeView';
import type { StringKey } from './strings';

interface Props {
  /** The parent's section of the notice (docs/NOTICE.md): its text, the name field and the checkbox labels. */
  section: NoticeSection;
  submitLabel: StringKey;
  onSubmit(consent: Consent): void;
}

/**
 * The consent of a parent or guardian (R37 item 9): their name and the checkbox, both required.
 * The invitation (JoinFlow) and the consent again (ConsentScreen, 6a.5b) show it the same way.
 */
export function ParentConsent({ section, submitLabel, onSubmit }: Props) {
  const { t } = useI18n();
  const [parentName, setParentName] = useState('');
  const [parentAgreed, setParentAgreed] = useState(false);
  const [missing, setMissing] = useState(false);
  const field = section.blocks.find((b) => b.kind === 'field');
  const check = section.blocks.find((b) => b.kind === 'check');

  const submit = () => {
    const name = cleanTypedName(parentName, PARENT_NAME_MAX);
    if (!name || !parentAgreed) {
      setMissing(true);
      return;
    }
    onSubmit({ version: NOTICE_VERSION, by: 'parent', parentName: name, parentAgreed: true });
  };

  return (
    <section className="notice">
      <p className="hint">{t('join.parentHint')}</p>
      <h1>{section.title}</h1>
      <NoticeBlocks blocks={section.blocks} />
      <label className="field">
        <span>{field?.kind === 'field' ? field.label : ''}</span>
        <input
          type="text"
          value={parentName}
          maxLength={PARENT_NAME_MAX}
          autoComplete="name"
          onChange={(e) => {
            setParentName(e.target.value);
            setMissing(false);
          }}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={parentAgreed}
          onChange={(e) => {
            setParentAgreed(e.target.checked);
            setMissing(false);
          }}
        />
        <span>{check?.kind === 'check' ? check.label : ''}</span>
      </label>
      {missing && (
        <p className="hint err" role="alert">
          {t('join.parentMissing')}
        </p>
      )}
      <button className="primary big mt" type="button" onClick={submit}>
        {t(submitLabel)}
      </button>
    </section>
  );
}
