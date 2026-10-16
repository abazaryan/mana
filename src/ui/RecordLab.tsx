import { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  LAB_CATEGORY_LABELS,
  isLabSet,
  labInstruction,
  type LabChromeResult,
  type LabManifest,
  type LabSet,
} from '../core/lab';
import { startRecording, toWav16k, type ActiveRecording } from '../platform/labAudio';
import { clearLab, loadLabSet, loadTakes, patchTake, saveLabSet, type LabTake } from '../platform/labDb';
import { downloadBlob } from '../platform/files';
import { createBrowserRecognizer } from '../platform/speech';
import type { RecognitionSession } from '../core/ports';

/**
 * Hidden page of the recognizer experiment (#/lab/record, not in any menu).
 * Pass 1 records each item with MediaRecorder; pass 2 asks Chrome Web Speech for the same
 * item alone (the two do not reliably work together on Android, Chromium 41403126).
 * Everything stays in the browser until "Export" makes a ZIP. Russian only: a working tool.
 */
type Pass = 'rec' | 'chrome';

const recognizer = createBrowserRecognizer();

function listenChrome(lang: string, onDone: (r: LabChromeResult) => void): RecognitionSession {
  const t0 = performance.now();
  const res: LabChromeResult = { alternatives: [], confidences: [], error: null, resultMs: null, spoiled: false };
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onDone(res);
  };
  return recognizer.start(lang, {
    onStart() {},
    onSpeechStart() {},
    onResult(u) {
      if (u.finalAlts) {
        res.alternatives = u.finalAlts;
        res.confidences = u.finalConfidences ?? [];
        res.resultMs ??= Math.round(performance.now() - t0);
      }
    },
    onError(code) {
      res.error = code;
    },
    onEnd: finish,
  });
}

export function RecordLab() {
  const [set, setSet] = useState<LabSet | null>(null);
  const [takes, setTakes] = useState<Map<string, LabTake>>(new Map());
  const [index, setIndex] = useState(0);
  const [pass, setPass] = useState<Pass>('rec');
  const [busy, setBusy] = useState<'recording' | 'listening' | 'exporting' | null>(null);
  const [error, setError] = useState('');
  const [simul, setSimul] = useState(false);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const active = useRef<ActiveRecording | null>(null);
  const simulSession = useRef<RecognitionSession | null>(null);
  const simulResult = useRef<LabChromeResult | null>(null);
  const chromeSession = useRef<RecognitionSession | null>(null);
  // Latest takes for callbacks that outlive a render.
  const takesRef = useRef(takes);
  takesRef.current = takes;

  useEffect(() => {
    void (async () => {
      setSet(await loadLabSet());
      setTakes(await loadTakes());
    })();
  }, []);

  const item = set?.items[index];
  const take = item ? takes.get(item.id) : undefined;

  // Object URL for listening back to the current take.
  useEffect(() => {
    if (!take?.blob) {
      setPlayUrl(null);
      return;
    }
    const url = URL.createObjectURL(take.blob);
    setPlayUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [take?.blob]);

  const patch = useCallback(async (itemId: string, p: Partial<LabTake>) => {
    const next = await patchTake(itemId, p);
    setTakes((m) => new Map(m).set(itemId, next));
  }, []);

  const loadFile = async (file: File) => {
    setError('');
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!isLabSet(data)) throw new Error('не набор записей (set.json)');
      await saveLabSet(data);
      setSet(data);
      setIndex(0);
    } catch (e) {
      setError(`Не удалось загрузить набор: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const startRec = async () => {
    if (!item || !set) return;
    setError('');
    try {
      simulResult.current = null;
      active.current = await startRecording();
      setBusy('recording');
      if (simul && recognizer.supported) {
        try {
          simulSession.current = listenChrome(set.language, (r) => (simulResult.current = r));
        } catch {
          simulResult.current = { alternatives: [], confidences: [], error: 'start-failed', resultMs: null, spoiled: false };
        }
      }
    } catch (e) {
      setError(`Микрофон не запустился: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const stopRec = async () => {
    if (!item || !active.current) return;
    const rec = active.current;
    active.current = null;
    const { blob, mimeType, durationMs } = await rec.stop();
    // Let the recognizer deliver its result for a moment, then drop it.
    const sim = simulSession.current;
    simulSession.current = null;
    if (sim) {
      await new Promise((r) => setTimeout(r, 1500));
      sim.abort();
    }
    await patch(item.id, {
      blob,
      mimeType,
      durationMs,
      spoiled: false,
      ...(sim ? { chromeSimultaneous: simulResult.current ?? { alternatives: [], confidences: [], error: 'no-event', resultMs: null, spoiled: false } } : {}),
    });
    setBusy(null);
  };

  const startChrome = () => {
    if (!item || !set) return;
    setError('');
    try {
      setBusy('listening');
      chromeSession.current = listenChrome(set.language, (r) => {
        chromeSession.current = null;
        setBusy(null);
        // The first attempt is the baseline; a retry is only logged (16.10.2026).
        const t = takesRef.current.get(item.id);
        void patch(item.id, t?.chromeFirst ? { chromeRetries: [...(t.chromeRetries ?? []), r] } : { chromeFirst: r });
      });
    } catch {
      setBusy(null);
      setError('Chrome не смог запустить распознавание.');
    }
  };

  const markSpoiled = async () => {
    if (!item) return;
    if (pass === 'rec') await patch(item.id, { spoiled: !take?.spoiled });
    else if (take?.chromeFirst) await patch(item.id, { chromeFirst: { ...take.chromeFirst, spoiled: !take.chromeFirst.spoiled } });
  };

  const exportZip = async () => {
    if (!set) return;
    setBusy('exporting');
    setError('');
    try {
      const zip = new JSZip();
      const manifest: LabManifest = {
        format: 'mana-lab-recordings',
        version: 1,
        language: set.language,
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        items: [],
      };
      for (const it of set.items) {
        const t = takes.get(it.id);
        let webm: string | null = null;
        let wav: string | null = null;
        if (t?.blob) {
          const ext = t.mimeType?.includes('mp4') ? 'm4a' : t.mimeType?.includes('ogg') ? 'ogg' : 'webm';
          webm = `audio/${it.id}.${ext}`;
          zip.file(webm, t.blob);
          const w = await toWav16k(t.blob);
          if (w) {
            wav = `audio/${it.id}.wav`;
            zip.file(wav, w);
          }
        }
        manifest.items.push({
          ...it,
          audioWebm: webm,
          audioWav: wav,
          mimeType: t?.mimeType ?? null,
          durationMs: t?.durationMs ?? null,
          spoiled: t?.spoiled ?? false,
          chrome: t?.chromeFirst ?? null,
          chromeRetries: t?.chromeRetries ?? [],
          chromeOld: t?.chrome ?? null,
          chromeSimultaneous: t?.chromeSimultaneous ?? null,
        });
      }
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `mana-lab-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (e) {
      setError(`Экспорт не удался: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(null);
  };

  const reset = async () => {
    if (!window.confirm('Удалить набор и все записи из этого браузера?')) return;
    await clearLab();
    setSet(null);
    setTakes(new Map());
    setIndex(0);
  };

  if (!set) {
    return (
      <div className="lab">
        <h1>Запись набора</h1>
        <p className="lead">Служебная страница эксперимента по распознаванию речи. Загрузите файл набора (set.json).</p>
        <input type="file" accept=".json,application/json" onChange={(e) => e.target.files?.[0] && void loadFile(e.target.files[0])} />
        {error && <p role="alert">{error}</p>}
        <p className="note">Микрофон: Chrome на телефоне. Записи остаются в браузере, пока вы не нажмёте «Экспорт».</p>
      </div>
    );
  }

  const recorded = set.items.filter((i) => takes.get(i.id)?.blob).length;
  const heard = set.items.filter((i) => takes.get(i.id)?.chromeFirst).length;
  const shown = pass === 'rec' ? recorded : heard;
  const nextTodo = () => {
    for (let k = 1; k <= set.items.length; k++) {
      const j = (index + k) % set.items.length;
      const t = takes.get(set.items[j]!.id);
      if (pass === 'rec' ? !t?.blob : !t?.chromeFirst) return j;
    }
    return (index + 1) % set.items.length;
  };
  const chrome = take?.chromeFirst;
  const retries = take?.chromeRetries ?? [];
  const spoiled = pass === 'rec' ? take?.spoiled : chrome?.spoiled;

  return (
    <div className="lab">
      <div className="lab-bar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className={pass === 'rec' ? 'primary' : ''} onClick={() => setPass('rec')} disabled={busy !== null}>
          Проход 1: запись ({recorded}/{set.items.length})
        </button>
        <button type="button" className={pass === 'chrome' ? 'primary' : ''} onClick={() => setPass('chrome')} disabled={busy !== null}>
          Проход 2: Chrome, первая попытка ({heard}/{set.items.length})
        </button>
      </div>
      <p className="note">
        {pass === 'rec'
          ? 'Нажмите «Записать», скажите фразу, нажмите «Стоп».'
          : 'Скажите ту же фразу ещё раз: теперь слушает Chrome (звук не сохраняется). Засчитывается первая попытка; «Ещё раз» только записывается в журнал.'}{' '}
        Готово: {shown} из {set.items.length}.
      </p>

      <section className="card" aria-live="polite" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, margin: '12px 0' }}>
        <div className="note">
          {index + 1} / {set.items.length} · {LAB_CATEGORY_LABELS[item!.category]}
        </div>
        <div style={{ fontSize: 30, fontWeight: 600, margin: '8px 0' }}>{item!.said}</div>
        <div className="note">{labInstruction(item!)}</div>
        {item!.said !== item!.reference && <div className="note">(эталон карточки: {item!.reference})</div>}

        <div style={{ margin: '16px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {pass === 'rec' ? (
            busy === 'recording' ? (
              <button type="button" className="primary big" onClick={() => void stopRec()}>
                ■ Стоп
              </button>
            ) : (
              <button type="button" className="primary big" onClick={() => void startRec()} disabled={busy !== null}>
                ● {take?.blob ? 'Записать заново' : 'Записать'}
              </button>
            )
          ) : (
            <button type="button" className="primary big" onClick={startChrome} disabled={busy !== null}>
              🎤 {busy === 'listening' ? 'Слушаю…' : chrome ? 'Ещё раз (не засчитывается)' : 'Говорить'}
            </button>
          )}
          {(pass === 'rec' ? take?.blob : chrome) && (
            <button type="button" onClick={() => void markSpoiled()}>
              {spoiled ? '✓ помечено: сорвалось' : 'Сорвалось'}
            </button>
          )}
        </div>

        {pass === 'rec' && playUrl && <audio controls src={playUrl} style={{ width: '100%' }} />}
        {pass === 'rec' && take?.chromeSimultaneous && (
          <p className="note">
            Заодно Chrome: {take.chromeSimultaneous.alternatives[0] ?? '— ничего —'}
            {take.chromeSimultaneous.error ? ` (ошибка: ${take.chromeSimultaneous.error})` : ''}
          </p>
        )}
        {pass === 'chrome' && chrome && (
          <p>
            Chrome услышал: <b>{chrome.alternatives[0] ?? '— ничего —'}</b>
            {chrome.error ? ` (ошибка: ${chrome.error})` : ''} — засчитана первая попытка.
            {retries.length > 0 && <> Повторы ({retries.length}): {retries.map((r) => r.alternatives[0] ?? '—').join(' · ')}</>}
          </p>
        )}
        {pass === 'rec' && (
          <label className="note" style={{ display: 'block' }}>
            <input type="checkbox" checked={simul} onChange={(e) => setSimul(e.target.checked)} disabled={busy !== null} /> Заодно запустить Chrome
            (проба одновременной работы; достаточно первых 5 пунктов)
          </label>
        )}
      </section>

      {error && <p role="alert">{error}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setIndex((index + set.items.length - 1) % set.items.length)} disabled={busy !== null}>
          ← Назад
        </button>
        <button type="button" onClick={() => setIndex((index + 1) % set.items.length)} disabled={busy !== null}>
          Дальше →
        </button>
        <button type="button" onClick={() => setIndex(nextTodo())} disabled={busy !== null}>
          К следующему незаписанному
        </button>
      </div>

      <hr />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="primary" onClick={() => void exportZip()} disabled={busy !== null}>
          {busy === 'exporting' ? 'Собираю…' : 'Экспорт ZIP'}
        </button>
        <button type="button" onClick={() => void reset()} disabled={busy !== null}>
          Начать заново
        </button>
      </div>
      <p className="note">
        Экспорт кладёт в ZIP звук (webm и WAV 16 кГц) и manifest.json. Файл попадёт в «Загрузки»; перенесите его на ноутбук и распакуйте в E:\dev\mana-lab\recordings\.
      </p>
    </div>
  );
}
