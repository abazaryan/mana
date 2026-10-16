import { encodeWav16 } from '../core/lab';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export interface ActiveRecording {
  /** Stops and returns the recording. */
  stop(): Promise<{ blob: Blob; mimeType: string; durationMs: number }>;
  /** Stops and discards. */
  cancel(): void;
}

/** Starts a recording from the microphone with the browser's default processing (as the app's recognizer gets it). */
export async function startRecording(): Promise<ActiveRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickRecorderMime();
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const t0 = performance.now();
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop() {
      return new Promise((resolve) => {
        rec.onstop = () => {
          release();
          resolve({
            blob: new Blob(chunks, { type: rec.mimeType }),
            mimeType: rec.mimeType,
            durationMs: Math.round(performance.now() - t0),
          });
        };
        if (rec.state !== 'inactive') rec.stop();
        else rec.onstop?.(new Event('stop'));
      });
    },
    cancel() {
      rec.onstop = null;
      try {
        if (rec.state !== 'inactive') rec.stop();
      } catch {
        /* ignore */
      }
      release();
    },
  };
}

/** Decodes a recording and returns it as 16 kHz mono 16-bit WAV; null if the browser cannot decode it. */
export async function toWav16k(blob: Blob): Promise<ArrayBuffer | null> {
  try {
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    void ctx.close();
    const rate = 16000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return encodeWav16(rendered.getChannelData(0), rate);
  } catch {
    return null;
  }
}
