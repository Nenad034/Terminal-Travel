---
name: tt-m20-ugovori-klijenti
description: Terminal Travel modul M20 (Ugovori sa klijentima) — zakonski obavezan Ugovor o organizovanju putovanja/posredovanju sa gostom/nalogodavcem. Učitaj kad zadatak piše/menja kod, dizajn ili specifikaciju za ovaj modul, umesto čitanja celog master dokumenta.
---

# M20 — Ugovori sa klijentima

Zakonski obavezan Ugovor o organizovanju putovanja/posredovanju sa gostom/nalogodavcem.

**Zavisi od:** M1, M2, M3, M5, M11

## Pre pisanja koda

1. Pročitaj ceo `docs/moduli/M20-ugovori-klijenti/21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md` — ovo je Nivo 2 specifikacija ovog modula i jedini oslonac za kod.
2. Nije potrebno čitati ceo `00-MASTER-ARHITEKTURA.md`. Ako zadatak zahteva arhitektonski kontekst (principe, model AI agenata, fazni plan, bezbednosni baseline), učitaj skill `tt-architecture-core`.
3. Ako zadatak dotiče i module iz liste zavisnosti iznad (ili obrnuto — modul koji zavisi od M20), učitaj i njihov `tt-m<broj>-*` skill pre nego što praviš izmenu na granici između modula.

## Tvrdo pravilo (iz CLAUDE.md — važi bez obzira koji skill je učitan)

- Nema koda bez oslonca u pisanoj specifikaciji. Ako zadatak nije pokriven `docs/moduli/M20-ugovori-klijenti/21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md` — stani pre pisanja koda, dopuni spec, traži potvrdu vlasnika (Nenad), tek onda piši kod.
- Modul nije završen dok svaka stavka u sekciji "Izlazni kriterijum" te specifikacije ne prođe.
- Moduli su granice, ne slojevi — ovaj modul pristupa drugima isključivo preko njihovog API-ja, nikad direktno u njihovu bazu.
- Ako izmena ovde utiče na drugi dokument (novo polje, novi događaj, promenjena numeracija poglavlja), izmeni oba u istom prolazu i pokreni `python tools/sync-html-overview.py` iz korena repozitorijuma.
