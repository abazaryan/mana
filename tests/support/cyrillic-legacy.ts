/**
 * Files that still have Cyrillic outside the allowed places, with the number of lines (snapshot of
 * 23.10.2026, the list is in docs/CYRILLIC_DEBT.md). This is debt, not an exception: the rule is in
 * CLAUDE.md ("Cyrillic in code"). What is left is text the user sees on the stage 1 prototype page
 * (#/prototype, Russian only): it needs keys in src/ui/strings.ts, and so Tajik texts from the
 * terminology chat. The test fails when a file gets more such lines, when a file not listed here
 * gets any, and when a file has fewer lines than listed: lower the number or delete the entry.
 */
export const LEGACY_LINES: Record<string, number> = {
  'src/core/format.ts': 1,
  'src/core/grade.ts': 10,
  'src/core/settings.ts': 3,
  'src/core/trainer.ts': 18,
  'src/platform/device.ts': 3,
  'src/ui/CardScreen.tsx': 15,
  'src/ui/DoneScreen.tsx': 5,
  'src/ui/LogSheet.tsx': 6,
  'src/ui/PrototypeApp.tsx': 4,
  'src/ui/SettingsSheet.tsx': 13,
  'src/ui/Sheet.tsx': 1,
  'src/ui/StartScreen.tsx': 22,
};
