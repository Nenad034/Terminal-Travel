---
name: tt-m22-email-inbox
description: Terminal Travel modul M22 (Email/Inbox platforma) — centralizovan email klijent, sva poslovna sandučad (deljena i lična), prepiska sa gostima/subagentima/dobavljačima, pojedinačna dodela pristupa po sandučetu, AI sažimanje i nacrt odgovora. Učitaj kad zadatak piše/menja kod, dizajn ili specifikaciju za ovaj modul, umesto čitanja celog master dokumenta.
---

# M22 — Email/Inbox platforma

Centralizovan email klijent — sva poslovna sandučad (deljena i lična zaposlenih), prepiska sa gostima/subagentima/dobavljačima, sa eksplicitnom, pojedinačnom dodelom pristupa po sandučetu (ne po opštoj ulozi) i AI agentom koji sažima/predlaže nacrt odgovora.

**Zavisi od:** M1, M14, M6, M7, M3, M15

## Pre pisanja koda

1. Pročitaj ceo `docs/moduli/M22-email-inbox/25-SPECIFIKACIJA-M22-EMAIL-INBOX.md` — ovo je Nivo 2 specifikacija ovog modula i jedini oslonac za kod.
2. Nije potrebno čitati ceo `00-MASTER-ARHITEKTURA.md`. Ako zadatak zahteva arhitektonski kontekst (principe, model AI agenata, fazni plan, bezbednosni baseline), učitaj skill `tt-architecture-core`.
3. Ako zadatak dotiče i module iz liste zavisnosti iznad (ili obrnuto — modul koji zavisi od M22, npr. M14 preko `Ticket.source_email_thread_id`), učitaj i njihov `tt-m<broj>-*` skill pre nego što praviš izmenu na granici između modula.

## Tvrdo pravilo (iz CLAUDE.md — važi bez obzira koji skill je učitan)

- Nema koda bez oslonca u pisanoj specifikaciji. Ako zadatak nije pokriven `docs/moduli/M22-email-inbox/25-SPECIFIKACIJA-M22-EMAIL-INBOX.md` — stani pre pisanja koda, dopuni spec, traži potvrdu vlasnika (Nenad), tek onda piši kod.
- Modul nije završen dok svaka stavka u sekciji "Izlazni kriterijum" te specifikacije ne prođe.
- Moduli su granice, ne slojevi — ovaj modul pristupa drugima isključivo preko njihovog API-ja, nikad direktno u njihovu bazu.
- Ako izmena ovde utiče na drugi dokument (novo polje, novi događaj, promenjena numeracija poglavlja), izmeni oba u istom prolazu i pokreni `python tools/sync-html-overview.py` iz korena repozitorijuma.
