---
name: tt-m4-integracije-api
description: Terminal Travel modul M4 (Integracije spoljnih API konekcija) — Travelgate, Solvex/Master-Interlook i WebHotelier (hoteli), budući avio/GDS, transferi, aktivnosti — sloj adaptera ka spoljnim provajderima. Učitaj kad zadatak piše/menja kod, dizajn ili specifikaciju za ovaj modul, umesto čitanja celog master dokumenta.
---

# M4 — Integracije spoljnih API konekcija

Travelgate, Solvex/Master-Interlook (hoteli, poglavlje 5a — SOAP, drugi HOTEL adapter, dodato avgust 2026) i WebHotelier (hoteli, poglavlje 5b — REST/Basic auth, treći HOTEL adapter za direktnu vezu sa konkretnim hotelima, dodato avgust 2026), budući avio/GDS, transferi, aktivnosti — sloj adaptera ka spoljnim provajderima.

**Zavisi od:** M1, M2

## Pre pisanja koda

1. Pročitaj ceo `docs/moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md` — ovo je Nivo 2 specifikacija ovog modula i jedini oslonac za kod.
2. Nije potrebno čitati ceo `00-MASTER-ARHITEKTURA.md`. Ako zadatak zahteva arhitektonski kontekst (principe, model AI agenata, fazni plan, bezbednosni baseline), učitaj skill `tt-architecture-core`.
3. Ako zadatak dotiče i module iz liste zavisnosti iznad (ili obrnuto — modul koji zavisi od M4), učitaj i njihov `tt-m<broj>-*` skill pre nego što praviš izmenu na granici između modula.

## Tvrdo pravilo (iz CLAUDE.md — važi bez obzira koji skill je učitan)

- Nema koda bez oslonca u pisanoj specifikaciji. Ako zadatak nije pokriven `docs/moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md` — stani pre pisanja koda, dopuni spec, traži potvrdu vlasnika (Nenad), tek onda piši kod.
- Modul nije završen dok svaka stavka u sekciji "Izlazni kriterijum" te specifikacije ne prođe.
- Moduli su granice, ne slojevi — ovaj modul pristupa drugima isključivo preko njihovog API-ja, nikad direktno u njihovu bazu.
- Ako izmena ovde utiče na drugi dokument (novo polje, novi događaj, promenjena numeracija poglavlja), izmeni oba u istom prolazu i pokreni `python tools/sync-html-overview.py` iz korena repozitorijuma.
