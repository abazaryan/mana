/** Plays deck audio stored in IndexedDB. One sound at a time. */
let current: { audio: HTMLAudioElement; url: string } | null = null;

export function stopAudio(): void {
  if (!current) return;
  current.audio.pause();
  URL.revokeObjectURL(current.url);
  current = null;
}

/** Resolves when playback starts; `onEnded` runs when it plays to the end (not when stopped). */
export async function playAudio(data: ArrayBuffer, type: string, onEnded?: () => void): Promise<void> {
  stopAudio();
  const url = URL.createObjectURL(new Blob([data], { type }));
  const audio = new Audio(url);
  const mine = { audio, url };
  current = mine;
  audio.addEventListener('ended', () => {
    if (current !== mine) return;
    stopAudio();
    onEnded?.();
  });
  try {
    await audio.play();
  } catch (e) {
    // Stopped by us (another sound, leaving the card) before it began: not a failure.
    if (current !== mine) return;
    stopAudio();
    throw e;
  }
}

