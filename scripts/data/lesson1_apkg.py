"""Cyrillic data of lesson 1 for scripts/convert_apkg.py (a data file for the Cyrillic check)."""

# Fields of the Anki note type of lesson 1, in order: text, IPA, meaning (Tajik), "write" flag, audio.
FIELDS = ["Français", "IPA", "Маъно", "Навиштан", "Аудио"]
FIELD_TEXT, FIELD_IPA, FIELD_MEANING, FIELD_WRITE, FIELD_AUDIO = FIELDS

# Anki tag -> (code, name). "кор" has no agreed meaning, so it keeps its Tajik name only.
TAGS = {
    "вожа": ("word", {"tg": "вожа", "ru": "слово", "en": "word"}),
    "адад": ("number", {"tg": "адад", "ru": "число", "en": "number"}),
    "кор": ("kor", {"tg": "кор"}),
}

# Deck title (R30): the deck name comes from deck.json, not from the file name.
TITLE = {"tg": "Фаронсавӣ · Дарси 1", "ru": "Французский · Урок 1", "en": "French · Lesson 1"}
