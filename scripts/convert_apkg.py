"""One-off converter: Anki lesson (apkg/fr_lesson_01.apkg) -> Sluh deck ZIP.

Not part of the app. Python 3.10+, standard library only.

    python scripts/convert_apkg.py apkg/fr_lesson_01.apkg decks/fr-lesson-01.zip

Expects the note type of lesson 1: fields Français, IPA, Маъно, Навиштан, Аудио.
Mapping (docs/DECK_FORMAT.md):
  Français -> fr; IPA -> ipa (without [ ]); Маъно -> meaning.tg;
  Аудио [sound:x.wav] -> audio/<id>.wav; Навиштан = "y" -> skills include "write";
  article le/la/un/une + noun -> gender m/f.
Entry ids are made from the French text once and must stay the same afterwards.
Check the result with: npm run deck:check -- decks/fr-lesson-01.zip
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sqlite3
import sys
import tempfile
import unicodedata
import zipfile
from pathlib import Path

FIELDS = ["Français", "IPA", "Маъно", "Навиштан", "Аудио"]
FIXED_TIME = (1980, 1, 1, 0, 0, 0)  # reproducible archive


def plain(text: str) -> str:
    """Anki field -> plain text."""
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text).replace(" ", " ")
    return unicodedata.normalize("NFC", re.sub(r"\s+", " ", text).strip())


def slug(fr: str) -> str:
    s = unicodedata.normalize("NFD", fr.lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.replace("œ", "oe").replace("æ", "ae")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:64]


def gender(fr: str) -> str | None:
    m = re.match(r"(le|la|un|une)\s+\S", fr, flags=re.I)
    if not m:
        return None
    return "m" if m.group(1).lower() in ("le", "un") else "f"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("apkg", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--id", default="fr-lesson-01")
    ap.add_argument("--title", default=None, help="default: Anki deck name")
    args = ap.parse_args()

    with zipfile.ZipFile(args.apkg) as src, tempfile.TemporaryDirectory() as tmp:
        names = set(src.namelist())
        if "collection.anki2" not in names:
            sys.exit("collection.anki2 not found (newer Anki export formats are not supported)")
        db_path = Path(tmp) / "collection.anki2"
        db_path.write_bytes(src.read("collection.anki2"))
        media = json.loads(src.read("media")) if "media" in names else {}
        by_name = {v: k for k, v in media.items()}

        db = sqlite3.connect(db_path)
        models = json.loads(db.execute("select models from col").fetchone()[0])
        decks = json.loads(db.execute("select decks from col").fetchone()[0])
        did = db.execute("select did from cards group by did order by count(*) desc").fetchone()[0]
        title = args.title or decks[str(did)]["name"].replace("::", " · ")

        entries, files, seen = [], {}, set()
        for mid, flds in db.execute("select mid, flds from notes order by id"):
            model = models[str(mid)]
            names_ = [f["name"] for f in model["flds"]]
            if names_ != FIELDS:
                sys.exit(f"unexpected note type {model['name']!r}: fields {names_}")
            f = dict(zip(names_, flds.split("\x1f")))

            fr = plain(f["Français"])
            entry_id = slug(fr)
            if not entry_id or entry_id in seen:
                sys.exit(f"cannot make a unique id for {fr!r}")
            seen.add(entry_id)

            entry: dict = {"id": entry_id, "fr": fr}
            ipa = plain(f["IPA"]).strip("[]/ ")
            if ipa:
                entry["ipa"] = ipa
            entry["meaning"] = {"tg": plain(f["Маъно"])}

            sound = re.search(r"\[sound:([^\]]+)\]", f["Аудио"])
            if sound:
                name = sound.group(1)
                if name not in by_name:
                    sys.exit(f"audio {name!r} is missing in the apkg")
                ext = Path(name).suffix.lower()
                path = f"audio/{entry_id}{ext}"
                files[path] = src.read(by_name[name])
                entry["audio"] = path

            g = gender(fr)
            if g:
                entry["gender"] = g
            entry["skills"] = ["listen", "speak"] + (["write"] if plain(f["Навиштан"]) else [])
            entries.append(entry)
        db.close()

    deck = {"format": "sluh-deck", "version": 1, "id": args.id, "title": title, "entries": entries}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as z:
        info = zipfile.ZipInfo("deck.json", FIXED_TIME)
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, json.dumps(deck, ensure_ascii=False, indent=2) + "\n")
        for path, data in sorted(files.items()):
            info = zipfile.ZipInfo(path, FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)

    writes = sum("write" in e["skills"] for e in entries)
    genders = sum("gender" in e for e in entries)
    print(f"{args.out}: {len(entries)} entries, {len(files)} audio files, "
          f"{writes} with 'write', {genders} with gender")
    return 0


if __name__ == "__main__":
    sys.exit(main())
