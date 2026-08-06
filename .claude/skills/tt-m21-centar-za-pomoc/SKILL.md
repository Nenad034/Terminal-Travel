---
name: tt-m21-centar-za-pomoc
description: Terminal Travel modul M21 (Centar za pomoć (baza znanja + AI asistent)) — uputstvo za korišćenje platforme za interni tim i B2B subagente, sa AI asistentom nad objavljenim sadržajem. Učitaj kad zadatak piše/menja kod, dizajn ili specifikaciju za ovaj modul, umesto čitanja celog master dokumenta.
---

# M21 — Centar za pomoć (baza znanja + AI asistent)

Uputstvo za korišćenje platforme za interni tim i B2B subagente, sa AI asistentom nad objavljenim sadržajem.

**Zavisi od:** M1, M14, M15, M7, M17

## Pre pisanja koda

1. Pročitaj ceo `23-SPECIFIKACIJA-M21-CENTAR-ZA-POMOC.md` — ovo je Nivo 2 specifikacija ovog modula i jedini oslonac za kod.
2. Nije potrebno čitati ceo `00-MASTER-ARHITEKTURA.md`. Ako zadatak zahteva arhitektonski kontekst (principe, model AI agenata, fazni plan, bezbednosni baseline), učitaj skill `tt-architecture-core`.
3. Ako zadatak dotiče i module iz liste zavisnosti iznad (ili obrnuto — modul koji zavisi od M21), učitaj i njihov `tt-m<broj>-*` skill pre nego što praviš izmenu na granici između modula.

## Tvrdo pravilo (iz CLAUDE.md — važi bez obzira koji skill je učitan)

- Nema koda bez oslonca u pisanoj specifikaciji. Ako zadatak nije pokriven `23-SPECIFIKACIJA-M21-CENTAR-ZA-POMOC.md` — stani pre pisanja koda, dopuni spec, traži potvrdu vlasnika (Nenad), tek onda piši kod.
- Modul nije završen dok svaka stavka u sekciji "Izlazni kriterijum" te specifikacije ne prođe.
- Moduli su granice, ne slojevi — ovaj modul pristupa drugima isključivo preko njihovog API-ja, nikad direktno u njihovu bazu.
- Ako izmena ovde utiče na drugi dokument (novo polje, novi događaj, promenjena numeracija poglavlja), izmeni oba u istom prolazu i pokreni `python tools/sync-html-overview.py` iz korena repozitorijuma.
