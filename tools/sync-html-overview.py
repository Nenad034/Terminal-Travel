"""Sinhronizuje 00-PREGLED-DOKUMENTACIJE.html sa trenutnim sadrzajem .md fajlova.

Svaka <section class="doc" id="doc-XX"> u HTML-u nosi sirov markdown
tekst odgovarajuceg fajla unutar <script type="text/plain" class="src">;
klijentski JS (mdToHtml, na dnu HTML-a) ga renderuje u browseru. Ova
skripta samo osvezava taj sirov tekst - ne dira CSS, navigaciju ni
renderer.

Pokretanje (iz korena repozitorijuma):
    python tools/sync-html-overview.py

Kad se doda nov modul, prvo dodati njegov nav-link i doc-<id> sekciju
rucno u HTML (CLAUDE.md), pa dodati odgovarajuci red u DOC_MAP ispod,
pa pokrenuti skriptu.
"""

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HTML_PATH = REPO / "00-PREGLED-DOKUMENTACIJE.html"

DOC_MAP = {
    "00": "00-MASTER-ARHITEKTURA.md",
    "01": "01-OBJASNJENJE-TEHNICKOG-STEKA.md",
    "m1": "02-SPECIFIKACIJA-M1-CORE-IDENTITET.md",
    "m2": "03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md",
    "m3": "04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md",
    "m4": "05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md",
    "m5": "06-SPECIFIKACIJA-M5-REZERVACIJE.md",
    "m10": "07-SPECIFIKACIJA-M10-FINANSIJE.md",
    "m11": "08-SPECIFIKACIJA-M11-COMPLIANCE.md",
    "m6": "09-SPECIFIKACIJA-M6-CRM.md",
    "m8": "10-SPECIFIKACIJA-M8-SAJT-B2C.md",
    "m17": "11-SPECIFIKACIJA-M17-INTERNI-PANEL.md",
    "m7": "12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md",
    "m13": "13-SPECIFIKACIJA-M13-BI.md",
    "m14": "14-SPECIFIKACIJA-M14-HELPDESK.md",
    "m12": "15-SPECIFIKACIJA-M12-MARKETING.md",
    "m9": "16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md",
    "m16": "17-SPECIFIKACIJA-M16-MCP-DISTRIBUCIJA.md",
    "m15": "18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md",
    "m18": "19-SPECIFIKACIJA-M18-OPERATIVNI-NADZOR.md",
    "m19": "20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md",
    "m20": "21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md",
    "m21": "23-SPECIFIKACIJA-M21-CENTAR-ZA-POMOC.md",
    "m22": "25-SPECIFIKACIJA-M22-EMAIL-INBOX.md",
}


def main():
    html = HTML_PATH.read_text(encoding="utf-8")

    missing_ids, changed, unchanged = [], [], []

    for doc_id, filename in DOC_MAP.items():
        md_content = (REPO / filename).read_text(encoding="utf-8").rstrip("\n")

        pattern = re.compile(
            r'(<section class="doc" id="doc-' + re.escape(doc_id) + r'">.*?'
            r'<script type="text/plain" class="src">\n)(.*?)(\n</script>)',
            re.DOTALL,
        )
        m = pattern.search(html)
        if not m:
            missing_ids.append(doc_id)
            continue

        if m.group(2).strip("\n") == md_content.strip("\n"):
            unchanged.append(doc_id)
            continue

        def repl(match, new=md_content):
            return match.group(1) + new + match.group(3)

        html = pattern.sub(repl, html, count=1)
        changed.append(doc_id)

    HTML_PATH.write_text(html, encoding="utf-8", newline="")

    print("Azurirano:", changed or "(nista)")
    print("Vec uskladjeno:", unchanged)
    if missing_ids:
        print("UPOZORENJE - nema doc-<id> sekcije u HTML-u za:", missing_ids,
              "- dodati rucno pre pokretanja skripte.")


if __name__ == "__main__":
    main()
