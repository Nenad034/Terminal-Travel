---
name: tt-m24-ljudski-resursi
description: Terminal Travel modul M24 (Ljudski resursi) — HR dosije zaposlenog (organizaciona pozicija/uloga, datumi zaposlenja, link ka ugovoru o radu, godišnji odmor/odsustva, rokovi obuka), namerno bez payroll-a. Učitaj kad zadatak piše/menja kod, dizajn ili specifikaciju za ovaj modul, umesto čitanja celog master dokumenta.
---

# M24 — Ljudski resursi

HR dosije zaposlenog — organizaciona pozicija (šira od M1 pristupne uloge), datumi zaposlenja/probnog roka/isteka ugovora na određeno, link ka potpisanom ugovoru o radu (transparentnost poslodavac↔zaposleni), godišnji odmor i odsustva, rokovi obuka/sertifikata. Namerno ISKLJUČUJE payroll (obračun plate, bankovni računi, poreske prijave).

**Zavisi od:** M1 (identitet, uloge/RBAC — HR dosije je vezan 1:1 na `User`, nove sistemske uloge žive u M1 katalogu). Meko od M18 (podsetnici o rokovima) i M15 (AI HR agent).

## Pre pisanja koda

1. Pročitaj ceo `docs/moduli/M24-ljudski-resursi/43-SPECIFIKACIJA-M24-LJUDSKI-RESURSI.md` — ovo je Nivo 2 specifikacija ovog modula i jedini oslonac za kod.
2. Nove sistemske uloge (`REFERENT_PRODAJE`, `SEF_POSLOVNICE`, `FINANSIJSKI_DIREKTOR`) i ograda oko `SEF_POSLOVNICE` (kombinovana, nikad samostalna) žive u M1 (`SYSTEM_ROLES`, `RoleAssignment`) — pre izmene te granice učitaj i `tt-m1-core-identitet`.
3. Nije potrebno čitati ceo `00-MASTER-ARHITEKTURA.md`. Ako zadatak zahteva arhitektonski kontekst (principe, model AI agenata, fazni plan, bezbednosni baseline), učitaj skill `tt-architecture-core`.
4. Pre implementacije konkretnih RBAC dozvola za nove uloge, proveri poglavlje 8 spec-a ("Otvoreno za dalje") — nekoliko odluka (da li Referent ima uže dozvole od Prodajnog agenta, tačan broj dana za podsetnik o isteku ugovora) su namerno ostavljene vlasniku, ne pretpostavljene.

## Tvrdo pravilo (iz CLAUDE.md — važi bez obzira koji skill je učitan)

- Nema koda bez oslonca u pisanoj specifikaciji. Ako zadatak nije pokriven `docs/moduli/M24-ljudski-resursi/43-SPECIFIKACIJA-M24-LJUDSKI-RESURSI.md` — stani pre pisanja koda, dopuni spec, traži potvrdu vlasnika (Nenad), tek onda piši kod.
- Modul nije završen dok svaka stavka u sekciji "Izlazni kriterijum" te specifikacije ne prođe.
- Moduli su granice, ne slojevi — ovaj modul pristupa drugima isključivo preko njihovog API-ja, nikad direktno u njihovu bazu.
- Payroll (obračun plate, bankovni računi, poreske prijave) je NAMERNO van obima — ne uvoditi ga bez novog, izričitog predloga i potvrde vlasnika.
- Ako izmena ovde utiče na drugi dokument (novo polje, novi događaj, promenjena numeracija poglavlja), izmeni oba u istom prolazu i pokreni `python tools/sync-html-overview.py` iz korena repozitorijuma.
