---
name: tt-m23-znanje
description: Terminal Travel modul M23 (Znanje) — baza sadržaja o destinacijama/proizvodima (zemlje, hoteli, izleti) koju AI agent gradi iz odobrenih izvora i osvežava na 30 dana uz ljudsko odobrenje; interni tim i subagenti pretražuju direktno, gost prima sadržaj samo preko deljenog javnog linka. Učitaj kad zadatak piše/menja kod, dizajn ili specifikaciju za ovaj modul, umesto čitanja celog master dokumenta.
---

# M23 — Znanje (baza sadržaja o destinacijama i proizvodima)

Baza sadržaja o stvarnim putničkim temama (zemlje, destinacije, hoteli, izleti), koju AI agent aktivno gradi iz odobrenih izvora i pomaže internom timu da nađe odgovor na pitanje gosta. Različito od M21 (uputstvo za korišćenje platforme, ne za putovanje).

**Zavisi od:** M1, M2, M7, M8, M15, M17

## Pre pisanja koda

1. Pročitaj ceo `docs/moduli/M23-znanje/28-SPECIFIKACIJA-M23-ZNANJE.md` — ovo je Nivo 2 specifikacija ovog modula i jedini oslonac za kod.
2. Nije potrebno čitati ceo `00-MASTER-ARHITEKTURA.md`. Ako zadatak zahteva arhitektonski kontekst (principe, model AI agenata, fazni plan, bezbednosni baseline), učitaj skill `tt-architecture-core`.
3. Ako zadatak dotiče i module iz liste zavisnosti iznad (ili obrnuto — modul koji zavisi od M23, npr. M8 preko javne rute `/znanje/[share_token]`, ili M15 preko glasovnog modaliteta), učitaj i njihov `tt-m<broj>-*` skill pre nego što praviš izmenu na granici između modula.

## Tvrdo pravilo (iz CLAUDE.md — važi bez obzira koji skill je učitan)

- Nema koda bez oslonca u pisanoj specifikaciji. Ako zadatak nije pokriven `docs/moduli/M23-znanje/28-SPECIFIKACIJA-M23-ZNANJE.md` — stani pre pisanja koda, dopuni spec, traži potvrdu vlasnika (Nenad), tek onda piši kod.
- Modul nije završen dok svaka stavka u sekciji "Izlazni kriterijum" te specifikacije ne prođe.
- Moduli su granice, ne slojevi — ovaj modul pristupa drugima isključivo preko njihovog API-ja, nikad direktno u njihovu bazu.
- Ako izmena ovde utiče na drugi dokument (novo polje, novi događaj, promenjena numeracija poglavlja), izmeni oba u istom prolazu i pokreni `python tools/sync-html-overview.py` iz korena repozitorijuma.
