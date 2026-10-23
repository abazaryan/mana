# Кириллица в коде: остаток

Снимок 23.10.2026. Правило — `CLAUDE.md`, «Кириллица в коде»; тест — `worker/no-cyrillic.test.ts`, потолок строк по файлам — `worker/test/cyrillic-legacy.ts`. Это долг, а не исключения. Разбор — отдельное задание после 6а.2; часть строк — подписи интерфейса, им нужны ключи в `strings.ts`, а значит таджикские тексты через чат терминологии.

Виды назначены автоматически (строка относится к виду по файлу и по тому, комментарий это, строковый литерал или JSX-текст); номера строк — для поиска. **Предположение:** в виде 1 строки из `src/core`, `src/platform`, `worker` и JSX-текст отнесены к «видит пользователь» по умолчанию, часть из них на деле может быть внутренним сообщением — уточнить при разборе. Вид 3 — строки, где кириллица только в комментарии. Файлы `*.test.ts` и `src/test` в виде 1 — это названия тестов, а не текст для пользователя (автоматическое назначение их не отделило). `src/core/frenchSpoken.ts` и `deckContent.ts`, возможно, ближе к виду 4 (данные).

## 1. Текст, который видит пользователь (и строки в коде, вероятно попадающие на экран)

Строк: **298**, файлов: 42.

| Файл | Строк | Номера строк |
| --- | --- | --- |
| `src/ui/RecordLab.tsx` | 32 | 100, 105, 124, 164, 219, 225, 235–236, 239, 263, 266, 271–273, 282, 288, 292, 297, 302, 310–311, 316–318, 323–324, 333, 336, 339, 346, 349, 353 |
| `src/core/frenchSpoken.ts` | 24 | 125, 132, 134, 136, 138, 140, 142, 144, 147, 155–169 |
| `src/ui/StartScreen.tsx` | 22 | 21, 39, 41, 49, 51–52, 55–56, 58–59, 62, 65–66, 72, 78, 81–82, 87, 93, 96–98 |
| `src/core/deckContent.ts` | 21 | 73, 85, 101–102, 115, 129, 144, 147, 159, 164, 176–177, 186, 191, 207, 249, 256–258, 267–268 |
| `src/core/trainer.ts` | 18 | 14–19, 200, 210, 221, 238, 241, 251, 274, 280–282, 314, 341 |
| `src/core/deckContent.test.ts` | 16 | 20, 27, 38, 44, 52, 57, 65, 72, 78, 90, 94, 131, 145, 151, 167, 173 |
| `src/ui/CardScreen.tsx` | 15 | 64, 87, 91, 94, 106, 120, 134, 137, 144, 148, 152, 157, 159, 175, 178 |
| `src/core/deckReport.ts` | 14 | 25, 27–30, 33–37, 63–66 |
| `src/core/lab.ts` | 14 | 33–41, 70, 72, 74, 76, 78 |
| `src/platform/repo.test.ts` | 14 | 218, 323, 336, 352, 446, 478, 504, 523–524, 541–542, 551, 562, 576 |
| `src/ui/SettingsSheet.tsx` | 13 | 25, 27, 38, 42, 46, 50, 55–56, 60, 64, 67, 72, 75 |
| `src/core/session.test.ts` | 12 | 131, 162, 211, 220, 281, 327, 365, 394, 422, 466, 492, 517 |
| `src/core/deck.ts` | 11 | 9–19 |
| `src/core/grade.ts` | 10 | 6–9, 45, 53, 56, 59, 62, 64 |
| `src/ui/LogSheet.tsx` | 6 | 33, 36, 47, 53, 56, 74 |
| `src/core/deckFormat.test.ts` | 5 | 150, 362, 591, 617, 631 |
| `src/ui/DoneScreen.tsx` | 5 | 17, 28–29, 33, 36 |
| `src/core/keyboard.test.ts` | 4 | 20, 42, 106, 163 |
| `src/ui/PrototypeApp.tsx` | 4 | 61, 63, 67, 70 |
| `src/core/cards.test.ts` | 3 | 135, 164, 232 |
| `src/core/languages.ts` | 3 | 153–154, 157 |
| `src/core/settings.ts` | 3 | 5–7 |
| `src/platform/device.ts` | 3 | 75, 83, 85 |
| `src/core/deckImport.test.ts` | 2 | 44, 106 |
| `src/core/deckReport.test.ts` | 2 | 23, 47 |
| `src/core/evaluate.test.ts` | 2 | 172, 227 |
| `src/core/glossaryTerms.ts` | 2 | 14, 20 |
| `src/core/review.test.ts` | 2 | 10, 86 |
| `src/core/spoken.test.ts` | 2 | 222, 383 |
| `src/core/spoken.ts` | 2 | 18, 20 |
| `src/core/deckArchive.ts` | 1 | 39 |
| `src/core/enterFlow.test.ts` | 1 | 39 |
| `src/core/format.ts` | 1 | 3 |
| `src/core/trainer.test.ts` | 1 | 235 |
| `src/core/voice.test.ts` | 1 | 272 |
| `src/core/voices.test.ts` | 1 | 6 |
| `src/core/zone.test.ts` | 1 | 83 |
| `src/platform/manifest.test.ts` | 1 | 27 |
| `src/ui/Sheet.tsx` | 1 | 11 |
| `src/ui/deckPrompt.test.ts` | 1 | 8 |
| `worker/build.test.ts` | 1 | 13 |
| `worker/wrangler-config.test.ts` | 1 | 53 |

## 2. Сообщения инструментов (`tools/admin`, `scripts/`, `validate-deck` и др.)

Строк: **84**, файлов: 7.

| Файл | Строк | Номера строк |
| --- | --- | --- |
| `scripts/make-test-speak.ts` | 59 | 24, 28–30, 45–46, 56–57, 65, 73–74, 83, 85–86, 96, 106, 114, 122, 132, 140, 148, 150, 158, 166, 177, 187, 195, 204, 206–207, 217, 219–221, 232, 234–235, 247–248, 256–257, 265–266, 275, 277–279, 290, 300, 310, 321, 331, 341, 349, 357, 365, 381, 389, 398 |
| `scripts/validate-deck.ts` | 11 | 19, 28, 31, 42, 61–64, 70–71, 74 |
| `scripts/make-test-meanings.ts` | 5 | 14, 20, 30, 40, 54 |
| `tools/admin/check-token.ts` | 5 | 22, 33–36 |
| `tools/admin/env.ts` | 2 | 19, 27 |
| `scripts/glossary-terms.ts` | 1 | 11 |
| `scripts/i18n-table.ts` | 1 | 12 |

## 3. Комментарии

Строк: **342**, файлов: 70.

| Файл | Строк | Номера строк |
| --- | --- | --- |
| `src/core/model.ts` | 38 | 6, 22, 32, 38, 49, 51, 68, 71, 89, 91, 108, 116, 118, 123, 133, 143, 147, 149, 151, 155, 160, 162, 164, 168, 186, 205, 234, 241, 243, 251, 253, 255, 264–265, 274, 286, 289, 295 |
| `src/core/session.ts` | 37 | 2, 5–6, 8–9, 17, 22, 27, 31, 34, 37, 43, 63, 65, 83, 88, 95, 105, 115, 117, 122, 124, 146, 166, 177, 204, 211, 249, 251, 254, 291, 293, 298, 345, 377, 400, 463 |
| `src/core/deckFormat.ts` | 24 | 12, 35–36, 71, 92, 104, 106, 110, 141, 154, 170, 202, 204, 254–255, 262, 485, 507, 670, 694, 737, 793, 835, 858 |
| `src/core/deckContent.ts` | 18 | 2, 72, 80, 87, 108, 134–136, 157, 162, 166, 183, 188, 195, 216, 228, 231, 233 |
| `src/core/evaluate.ts` | 18 | 2, 4, 17, 29, 116, 170, 172, 300, 325, 349, 351, 369, 371, 377, 380, 392, 417, 459 |
| `src/core/languages.ts` | 15 | 2, 6–7, 30, 76, 104, 129–130, 134, 136, 138, 140, 145–146, 204 |
| `src/ui/StudyScreen.tsx` | 15 | 2, 7–8, 56, 82, 118, 125, 159, 204, 223, 238, 299, 320, 355, 435 |
| `src/platform/repo.ts` | 13 | 66, 77, 145, 165, 199–200, 231, 240, 281, 292, 305, 309, 340 |
| `src/core/spoken.ts` | 11 | 2, 14, 19, 68, 76, 330, 422, 425, 454, 485, 504 |
| `scripts/make-test-speak.ts` | 9 | 5–8, 12–13, 17, 285, 316 |
| `src/core/frenchSpoken.ts` | 8 | 2, 6, 73, 86, 88, 93, 97, 110 |
| `src/core/review.ts` | 8 | 2, 12, 19, 40, 46, 65, 81, 83 |
| `src/core/scheduler.ts` | 6 | 9, 41, 46, 53, 99, 123 |
| `src/ui/VoiceCard.tsx` | 6 | 2, 9–10, 46, 257, 275 |
| `src/core/cards.ts` | 5 | 2, 8, 14, 50, 75 |
| `src/core/zone.ts` | 5 | 2, 11, 13, 68, 101 |
| `src/ui/WriteCard.tsx` | 5 | 2, 4–5, 7, 34 |
| `src/core/deckArchive.ts` | 4 | 2, 17, 73–74 |
| `src/core/deckImport.ts` | 4 | 2, 10, 30, 57 |
| `src/core/grade.ts` | 4 | 13, 15, 17, 19 |
| `src/ui/DeckScreen.tsx` | 4 | 21, 53, 67, 188 |
| `src/ui/DecksScreen.tsx` | 4 | 34, 63, 121–122 |
| `src/ui/TypeField.tsx` | 4 | 7, 11, 61, 108 |
| `scripts/validate-deck.ts` | 3 | 3–4, 67 |
| `src/core/deckReport.ts` | 3 | 2, 4–5 |
| `src/core/keyboard.ts` | 3 | 2, 130, 153 |
| `src/core/rating.ts` | 3 | 2, 61, 70 |
| `src/core/voice.ts` | 3 | 3, 39, 87 |
| `src/ui/OnScreenKeyboard.tsx` | 3 | 2, 5, 83 |
| `src/ui/PracticeSteps.tsx` | 3 | 4–5, 21 |
| `src/ui/SettingsScreen.tsx` | 3 | 17, 67, 76 |
| `src/ui/deckPrompt.ts` | 3 | 2, 9, 325 |
| `src/ui/studyHooks.ts` | 3 | 95, 109, 128 |
| `scripts/glossary-terms.ts` | 2 | 2–3 |
| `src/core/format.ts` | 2 | 1, 6 |
| `src/core/glossaryTerms.ts` | 2 | 2, 8 |
| `src/core/printConventions.ts` | 2 | 8, 10 |
| `src/core/scheduler.test.ts` | 2 | 41, 107 |
| `src/ui/ImportSheet.tsx` | 2 | 10, 114 |
| `src/ui/IntroCard.tsx` | 2 | 2, 7 |
| `src/ui/Marks.tsx` | 2 | 2, 235 |
| `src/ui/MicPanel.tsx` | 2 | 24, 32 |
| `worker/index.ts` | 2 | 2, 6 |
| `scripts/render-icons.ts` | 1 | 2 |
| `src/core/backup.ts` | 1 | 3 |
| `src/core/build.ts` | 1 | 5 |
| `src/core/deck.ts` | 1 | 22 |
| `src/core/deckImport.test.ts` | 1 | 40 |
| `src/core/enterFlow.ts` | 1 | 2 |
| `src/core/lab.ts` | 1 | 52 |
| `src/core/review.test.ts` | 1 | 93 |
| `src/core/textEdit.ts` | 1 | 2 |
| `src/core/trainer.ts` | 1 | 10 |
| `src/core/voices.ts` | 1 | 2 |
| `src/core/zone.test.ts` | 1 | 6 |
| `src/platform/device.ts` | 1 | 11 |
| `src/platform/keyboardEnv.ts` | 1 | 2 |
| `src/platform/speech.ts` | 1 | 150 |
| `src/ui/CopyButton.tsx` | 1 | 2 |
| `src/ui/FirstRun.tsx` | 1 | 5 |
| `src/ui/NextButton.tsx` | 1 | 2 |
| `src/ui/RatingPanel.tsx` | 1 | 2 |
| `src/ui/RulesUpdate.tsx` | 1 | 2 |
| `src/ui/VoiceCheck.tsx` | 1 | 2 |
| `src/ui/i18n.tsx` | 1 | 6 |
| `src/ui/keyboardMode.tsx` | 1 | 2 |
| `vite.config.ts` | 1 | 5 |
| `worker/profile.ts` | 1 | 2 |
| `worker/test/sqlite-d1.ts` | 1 | 3 |
| `worker/wrangler-config.test.ts` | 1 | 6 |

## 4. Тексты-данные (шаблон для ИИ в `deckPrompt.ts`, описания и сообщения проверки в `deckFormat.ts`, схема)

Строк: **254**, файлов: 3.

| Файл | Строк | Номера строк |
| --- | --- | --- |
| `src/ui/deckPrompt.ts` | 124 | 30, 32–34, 36–47, 49–52, 54, 61, 63–65, 72, 82, 90, 92–97, 99–120, 122–125, 127–130, 132–136, 139–151, 153–159, 161–170, 172–174, 250, 252, 285–295, 297, 320, 322, 342–346, 350 |
| `src/core/deckFormat.ts` | 113 | 165, 177–178, 181–183, 186–187, 221, 224, 226, 230, 315, 322, 330, 334, 338, 342, 344, 351, 355, 361, 382, 388, 397, 402, 405, 412, 416, 420, 424, 429, 437, 441, 445, 451, 453, 460, 466, 473, 475, 477, 492, 498, 502, 520, 525, 541, 545, 554, 565, 571, 587, 589, 598, 600, 602, 604, 606–609, 611, 613, 616, 620, 625, 630, 637, 646, 652, 661, 687–688, 703, 708, 713–714, 718, 720, 725–726, 729, 731, 733, 741–742, 745, 749, 751, 757, 759, 761, 773, 780, 786, 800, 804, 811, 831, 844, 846, 853, 871, 892–893, 916–917, 926–927, 937–939 |
| `src/core/mana-deck.schema.json` | 17 | 4–5, 26, 31, 36, 46, 50, 60, 70, 97, 101, 108, 112, 120, 128, 131, 158 |

## 5. `tools/lab` (лаборатория закрыта, Р23)

Строк: **55**, файлов: 3.

| Файл | Строк | Номера строк |
| --- | --- | --- |
| `tools/lab/compare.ts` | 35 | 26, 135–136, 188, 256–257, 283–285, 310, 312, 318–319, 329–331, 337, 340, 342, 345, 349, 354–355, 361–362, 368–369, 375, 384, 386, 391–392, 402, 406, 425 |
| `tools/lab/check-cloudflare.ts` | 10 | 11, 29, 44–46, 51–52, 78–79, 81 |
| `tools/lab/make-set.ts` | 10 | 29, 50–51, 78–80, 86, 88, 90, 95 |

Всего: 1033 строки (было 1037; 23.10.2026 при 6а.2 исправлены `worker/config.ts`, `wrangler.jsonc`, `src/ui/MainApp.tsx`, `src/ui/Root.tsx`).
