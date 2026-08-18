# AI agenti — šta rade sami, šta uz odobrenje, šta nikad (pregledna lista)

**Status:** Živ dokument — pregledna, čitljiva verzija M15 registra akcija, radi brzog uvida bez čitanja pune specifikacije.
**Izvor istine:** `docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md`, poglavlje 4 (`AgentActionType` registar) — ova lista je **izvedena** iz tog registra, ne obrnuto. Kad god se registar u M15 spec-u promeni (nova akcija, promenjen nivo), **ovaj dokument se ažurira u istom prolazu** — isti princip kao svaka druga cross-referenca u projektu (CLAUDE.md, "Održavanje dokumentacije").
**Nastalo:** avgust 2026, na zahtev vlasnika.

---

## Tri nivoa, ukratko

- 🟢 **AUTONOMNO** — agent radi sam, bez čekanja na čoveka. Uvek je reč o nečem informativnom ili nacrtu koji još ne postoji van sistema — nikad novac, potpis ili poruka sa obavezom koja izlazi ka gostu/dobavljaču.
- 🟡 **PREDLOŽI PA ČOVEK ODOBRI** — agent priprema, ali čovek mora svesno da klikne pre nego što nešto postane stvarno (pošalje se, primeni se, objavi se).
- 🔴 **NIKAD AUTONOMNO** — agent to ne sme da uradi ni sa formalnom dozvolom u sistemu. Sprovedeno na nivou koda (`AgentActionGuard`, M15 spec poglavlje 5) — dupla brava, ne samo procedura.

---

## 🟢 Autonomno

| Modul | Akcija |
| :---- | :---- |
| M3 | Izvlačenje podataka iz uvezenog cenovnika |
| M3 | Upozorenje o niskom kapacitetu (1–2 jedinice ostalo) |
| M5 | Priprema nacrta manifesta za dobavljača |
| M6 | Nacrt poruke gostu/nalogodavcu |
| M7 | Izračun nacrta provizionog rabata |
| M7 | Pretraga kataloga u chatu sa subagentom |
| M7 | Nacrt ponude u chatu sa subagentom |
| M10 | Priprema nacrta fiskalnog dokumenta |
| M11 | Podsetnik na istek garancije putovanja |
| M11 | Upozorenje na 80% iskorišćenosti garancije |
| M12 | Nacrt marketing sadržaja |
| M13 | Isticanje uočenog trenda u izveštaju |
| M14 | Nacrt odgovora na tiket podrške |
| M14 | Eskalacija reklamacije (zakonski rok) |
| M18 | Nacrt istraživanja trenda |
| M18 | Detekcija i obaveštenje o signalu kvara |
| M20 | Nacrt ugovora sa klijentom (iz determinističkih pravila) |
| M21 | Odgovor na pitanje iz Centra za pomoć (samo objavljen sadržaj) |
| M21 | Kreiranje eskalacije sopstvenog pitanja korisnika |
| M21 | Nacrt predloga za novi help članak |
| M23 | Odgovor na pitanje iz baze znanja (samo objavljen sadržaj) |
| M23 | Nacrt istraživanja za reviziju članka |
| M23 | Nacrt prevoda članka na ostale jezike (deljen AI prevodilac, M15 poglavlje 6.7) |
| (globalno) | Omnisearch pretraga/navigacija |
| (globalno) | Pretraga spoljnih recenzija (samo sa odobrenog spiska sajtova) |

## 🟡 Predloži pa čovek odobri

| Modul | Akcija |
| :---- | :---- |
| M3 | Upozorenje o isteku roka ugovora (pre slanja) |
| M3 | Odobravanje reda iz uvezenog cenovnika |
| M5 | Slanje manifesta dobavljaču |
| M5 | Provera dupliranog zahteva za storno (pre same akcije) |
| M6 | Slanje poruke gostu koja sadrži cenu ili obavezu |
| M7 | Primena provizionog rabata |
| M7 | Potvrda rezervacije u chatu sa subagentom (potvrđuje subagent sam, ne osoblje) |
| M12 | Odobravanje objave marketing sadržaja |
| M14 | Slanje odgovora na tiket koji sadrži cenu ili obavezu |
| (globalno) | Opšta pretraga interneta van poznatih izvora (svaki poziv, ne samo aktivacija) |
| M18 | Primena istraženog trenda na dokumentaciju |
| M21 | Odobravanje predloženog help članka |

## 🔴 Nikad autonomno

| Modul | Akcija |
| :---- | :---- |
| M10 | Slanje fiskalnog dokumenta (faktura/račun) |
| M11 | Izmena garancije putovanja |
| M23 | Objavljivanje članka u bazi znanja |
| (globalno) | Potpisivanje ugovora |
| (globalno) | Prenos novca |
| (globalno) | Izmena licenciranih/regulatornih podataka |

---

## Napomena

Registar (i time ova lista) se dopunjuje kad god budući modul ili izmena postojećeg uvede novu akciju koju AI agent dodiruje — ne postoji podrazumevani nivo, svaka nova akcija mora eksplicitno dobiti nivo pre nego što se agent pusti na nju (M15 spec poglavlje 4).
