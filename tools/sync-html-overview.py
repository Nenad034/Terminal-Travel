"""Sinhronizuje 00-PREGLED-DOKUMENTACIJE.html sa trenutnim sadrzajem .md fajlova.

Svaka <section class="doc" id="doc-XX"> u HTML-u nosi sirov markdown
tekst odgovarajuceg fajla unutar <script type="text/plain" class="src">;
klijentski JS (mdToHtml, na dnu HTML-a) ga renderuje u browseru. Ova
skripta samo osvezava taj sirov tekst - ne dira CSS, navigaciju ni
renderer.

Pokretanje (iz korena repozitorijuma):
    python tools/sync-html-overview.py

Svi izvorni .md fajlovi i sam 00-PREGLED-DOKUMENTACIJE.html žive pod docs/
(opšti dokumenti direktno u docs/, moduli u docs/moduli/M<broj>-<slug>/,
cross-modularne analize u docs/analize/) - vidi CLAUDE.md.

Kad se doda nov modul, prvo dodati njegov nav-link i doc-<id> sekciju
rucno u HTML (CLAUDE.md), pa dodati odgovarajuci red u DOC_MAP ispod,
pa pokrenuti skriptu.

KRITIČNO — prazna <script type="text/plain" class="src"> sekcija MORA imati
praznu liniju izmedju otvarajuceg i zatvarajuceg taga:

    <script type="text/plain" class="src">

    </script>

NE ovako (samo jedan newline, bez prazne linije):

    <script type="text/plain" class="src">
    </script>

Regex u ovoj skripti trazi "\n</script>" da zatvori sekciju; ako je razmak
izmedju tagova samo jedan newline, taj newline biva potrosen kao deo
otvarajuceg literala i regex "preskoci" do SLEDECEG "\n</script>" u
dokumentu - u praksi to je zatvarajuci tag SLEDECE (prazne) sekcije, sto
u potpunosti izbrise njenu <section> oznaku iz fajla bez ikakve greske pri
pokretanju (osim upozorenja "nema doc-<id> sekcije" za modul ciji je tag
progutan). Ovo se dogodilo uzivo avgust 2026 pri dodavanju M22/M23 i
obrisalo je citav zavrsni JS renderer (mdToHtml/IntersectionObserver) iz
fajla - vidi git istoriju commit-a koji dodaje M23 za sanaciju/detalje.
"""

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs"
HTML_PATH = DOCS / "00-PREGLED-DOKUMENTACIJE.html"

DOC_MAP = {
    "00": DOCS / "00-MASTER-ARHITEKTURA.md",
    "01": DOCS / "01-OBJASNJENJE-TEHNICKOG-STEKA.md",
    "m1": DOCS / "moduli/M01-core-identitet/02-SPECIFIKACIJA-M1-CORE-IDENTITET.md",
    "m2": DOCS / "moduli/M02-katalog-proizvoda/03-SPECIFIKACIJA-M2-KATALOG-PROIZVODA.md",
    "m3": DOCS / "moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md",
    "m4": DOCS / "moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md",
    "m5": DOCS / "moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md",
    "m10": DOCS / "moduli/M10-finansije/07-SPECIFIKACIJA-M10-FINANSIJE.md",
    "m11": DOCS / "moduli/M11-compliance/08-SPECIFIKACIJA-M11-COMPLIANCE.md",
    "m6": DOCS / "moduli/M06-crm/09-SPECIFIKACIJA-M6-CRM.md",
    "m8": DOCS / "moduli/M08-sajt-b2c/10-SPECIFIKACIJA-M8-SAJT-B2C.md",
    "m17": DOCS / "moduli/M17-interni-panel/11-SPECIFIKACIJA-M17-INTERNI-PANEL.md",
    "m7": DOCS / "moduli/M07-b2b-subagenti/12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md",
    "m13": DOCS / "moduli/M13-bi/13-SPECIFIKACIJA-M13-BI.md",
    "m14": DOCS / "moduli/M14-helpdesk/14-SPECIFIKACIJA-M14-HELPDESK.md",
    "m12": DOCS / "moduli/M12-marketing/15-SPECIFIKACIJA-M12-MARKETING.md",
    "m9": DOCS / "moduli/M09-mobilna-aplikacija/16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md",
    "m16": DOCS / "moduli/M16-mcp-distribucija/17-SPECIFIKACIJA-M16-MCP-DISTRIBUCIJA.md",
    "m15": DOCS / "moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md",
    "m18": DOCS / "moduli/M18-operativni-nadzor/19-SPECIFIKACIJA-M18-OPERATIVNI-NADZOR.md",
    "m19": DOCS / "moduli/M19-komunikaciona-platforma/20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md",
    "m20": DOCS / "moduli/M20-ugovori-klijenti/21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md",
    "m21": DOCS / "moduli/M21-centar-za-pomoc/23-SPECIFIKACIJA-M21-CENTAR-ZA-POMOC.md",
    "m22": DOCS / "moduli/M22-email-inbox/25-SPECIFIKACIJA-M22-EMAIL-INBOX.md",
    "m23": DOCS / "moduli/M23-znanje/28-SPECIFIKACIJA-M23-ZNANJE.md",
}


def main():
    html = HTML_PATH.read_text(encoding="utf-8")

    missing_ids, changed, unchanged = [], [], []

    for doc_id, path in DOC_MAP.items():
        md_content = path.read_text(encoding="utf-8").rstrip("\n")

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
