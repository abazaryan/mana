/** Where the bench keeps what it makes: tools/bench/.out/ (in .gitignore). */
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const OUT = fileURLToPath(new URL('./.out/', import.meta.url));
/** Record sizes taken from a journal file by journal-sizes.ts (numbers only). */
export const SIZES_FILE = `${OUT}sizes.json`;
/** The Worker as wrangler would upload it (wrangler deploy --dry-run --outdir). */
export const BUNDLE_DIR = `${OUT}worker`;
export const BUNDLE = `${BUNDLE_DIR}/index.js`;
/** Calls and D1 answers recorded in Node (node-cpu.ts --record) for replay-worker.js in workerd. */
export const REPLAY = `${OUT}replay/`;
