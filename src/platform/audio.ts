/** Plays deck audio stored in IndexedDB. One sound at a time. */
let current: { audio: HTMLAudioElement; url: string } | null = null;

export function stopAudio(): void {
  if (!current) return;
  current.audio.pause();
  URL.revokeObjectURL(current.url);
  current = null;
}

export async function playAudio(data: ArrayBuffer, type: string): Promise<void> {
  stopAudio();
  const url = URL.createObjectURL(new Blob([data], { type }));
  const audio = new Audio(url);
  const mine = { audio, url };
  current = mine;
  audio.addEventListener('ended', () => {
    if (current === mine) stopAudio();
  });
  try {
    await audio.play();
  } catch (e) {
    if (current === mine) stopAudio();
    throw e;
  }
}

