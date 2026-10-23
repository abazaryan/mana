/**
 * Files that still have Cyrillic outside the allowed places, with the number of lines. Empty since
 * 23.10.2026: the debt (docs/CYRILLIC_DEBT.md) is closed. This is debt, not an exception: the rule is
 * in CLAUDE.md ("Cyrillic in code"). Allowed places are only the files in DATA_FILES
 * (tests/support/cyrillic.ts). If a file ever has to be listed here, the test fails when it gets
 * more such lines, when a file not listed gets any, and when a file has fewer lines than listed.
 */
export const LEGACY_LINES: Record<string, number> = {};
