---
name: tt-architecture-core
description: Terminal Travel arhitektonski principi, model upravljanja AI agentima, fazni plan i bezbednosni baseline — poglavlja 1, 2, 3, 5, 7, 8, 9 master dokumenta. Učitaj kad zadatak dotiče više modula odjednom, predlaže nov modul, menja arhitekturu/tok podataka, ili kad je potreban kontekst o fazi izgradnje/bezbednosti/AI ovlašćenjima — ne za rad unutar granica jednog već specifikovanog modula (za to koristi tt-m<broj>-* skill).
---

# Terminal Travel — arhitektonsko jezgro

Ovo je pointer-skill, ne zamena za tekst: pravi sadržaj ostaje isključivo u `docs/00-MASTER-ARHITEKTURA.md`, jer se to je izvor istine i ne duplira se ovde (dupliranje bi vodilo do neusklađenosti kad se master dokument izmeni).

## Kad koristiti ovaj skill

- Zadatak dotiče **više modula** i treba proveriti da granice/zavisnosti ostaju poštovane (princip #2, poglavlje 4).
- Predlažeš **nov modul** ili menjaš postojeću mapu modula.
- Zadatak uključuje AI agenta koji dobija **ovlašćenje da nešto izvrši** (novac, fiskalne obaveze, pravno obavezujuću komunikaciju) — proveri poglavlje 7.
- Treba da znaš **u kojoj fazi** trenutno gradimo i da li je nešto van reda (poglavlje 8).
- Zadatak dotiče lične/zdravstvene podatke, lokaciju infrastrukture, ili bilo šta regulatorno van pojedinačnog modula (poglavlje 9).
- Nov saradnik/agent treba brzu orijentaciju pre prve izmene (poglavlja 1–2).

Za rad **unutar** jednog već specifikovanog modula (npr. "dodaj polje u M5 rezervaciju"), ovaj skill nije potreban — dovoljan je `tt-m<broj>-*` skill tog modula.

## Šta pročitati u `docs/00-MASTER-ARHITEKTURA.md`

| Poglavlje | Sadržaj | Kad je bitno |
| :---- | :---- | :---- |
| 1. Vizija i obim | Strateški kontekst, šta dokument NIJE | Orijentacija novog agenta |
| 2. Poslovni pojmovnik | Domain glossary | Kad termin nije jasan iz konteksta |
| 3. Pet vodećih principa | Jedan izvor istine, moduli su granice, provajderi su adapteri, determinizam pre autonomije, sve se revidira | **Uvek** kad zadatak prelazi granicu jednog modula |
| 4. Mapa modula | Tabela M1–M21, zavisnosti | Kad treba proveriti zavisnost (i onda učitaj `tt-m<broj>-*` odgovarajućeg modula) |
| 5. Referentna arhitektura | Dijagram slojeva, ko sme da zove koga | Kad zadatak dodaje novu integraciju ili kanal |
| 7. Model upravljanja AI agentima (M15) | Pravila ovlašćenja za AI agente kroz ceo sistem | Svaki put kad AI agent dobija izvršnu ulogu, ne samo asistivnu |
| 8. Fazni plan | Faza 0 → Faza 7, redosled izgradnje | Pre nego što predložiš da se nešto gradi van reda |
| 9. Bezbednosni i regulatorni baseline | Lični/zdravstveni podaci, EU lokacija, zakonska usklađenost | Svaki modul koji dodiruje podatke o gostima ili plaćanje |

## Tvrdo pravilo (iz CLAUDE.md)

- Ne uvoditi novu tehnologiju/pattern koji nije u poglavlju 6 (za to koristi `tt-tech-stack`) bez potvrde vlasnika.
- Ne graditi rešenje mimo modularnih granica iz principa #2 — moduli komuniciraju isključivo preko API-ja.
- Ako predlažeš nov modul ili menjaš mapu modula: predlog → potvrda vlasnika (Nenad) → upis u `docs/00-MASTER-ARHITEKTURA.md` poglavlje 4 — isti obrazac po kom su M15–M21 dodati.
