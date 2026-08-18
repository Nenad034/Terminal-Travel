# Konsolidovana lista — pravna i knjigovodstvena pitanja koja čekaju potvrdu pre implementacije

**Svrha ovog dokumenta:** svaka Nivo 2 specifikacija već sadrži pojedinačne napomene tipa "potvrditi sa pravnikom/knjigovođom pre implementacije" — namerno ostavljene otvorene jer Master dokument (poglavlje 1.2) eksplicitno predviđa uključivanje ljudskog stručnjaka za pravo, računovodstvo i bezbednost, ne nagađanje AI agenta. Ovaj dokument ih sve skuplja na jedno mesto, organizovane po tome kom stručnjaku pripadaju, tako da se mogu obraditi u jednom prolazu umesto da isplivavaju pojedinačno tokom implementacije.

**Kako koristiti:** nijedna stavka ovde ne blokira dalje pisanje specifikacije za druge module — blokira samo **implementaciju** dela na koji se odnosi. Kad se pitanje reši (sa knjigovođom/pravnikom/zvaničnom dokumentacijom), odgovor se upisuje direktno u navedeno poglavlje izvorne specifikacije, ne ovde — ovaj dokument je radna lista za praćenje, ne mesto gde se čuva sam odgovor.

---

## A. Za knjigovođu — poreski i računovodstveni deo

| # | Pitanje | Gde se pominje | Zašto je bitno |
| :---- | :---- | :---- | :---- |
| A1 | Tačan tehnički ugovor sa **SEF v4.0.0** i izabranim sertifikovanim **ESIR** rešenjem (format polja, XML, autentikacija) | `07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 6 | SEF v4.0.0 je u vreme pisanja specifikacije još u demo okruženju — implementacija fiskalizacije ne sme da pretpostavlja format unapred. |
| A2 | **Granični slučajevi PDV po sistemu marže** (Čl. 35): mešoviti aranžmani (kombinacija sopstvenih ugovorenih usluga i usluga preprodatih od drugog organizatora u istoj rezervaciji), samostalna prodaja pojedinačne usluge van paketa | `07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 4.4 i 12 | Osnovni slučaj (organizator/posrednik) je specificiran; granični slučajevi utiču i na `M20-UGOVORI-KLIJENTI.md` (`contract_type = PRODAJA_AVIO_KARTE`/`TRANSFER`, poglavlje 12). |
| A3 | Koji kurs se koristi kad se ista faktura naplati u **više navrata** (avans + balans) sa različitim NBS kursom po ratama | `07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 3 | Kurs konverzije je nedavno promenjen na "dan uplate" (avgust 2026) — pravilo za jednokratnu uplatu je jasno, za više rata nije. |
| A4 | Tačan tehnički format kojim SEF prihvata **knjižno odobrenje** (`KNJIZNO_ODOBRENJE`, B2B retroaktivni rabat subagentu) — zaseban dokument tip, redovna e-faktura sa negativnim iznosom, ili treći mehanizam | `07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 5.1a | Model podataka postoji, tehnički ugovor sa SEF-om ne. |
| A5 | **FX rizik kod isplata dobavljačima u stranoj valuti** preko bankovnog transfera — da li agencija treba devizni račun, ili svaka isplata ide kroz konverziju banke u trenutku transfera | `07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 8.5 | Utiče na to da li postojeći `exchange_rate_difference` mehanizam ostaje dovoljan. |
| A6 | Pravna posledica `buyer_acceptance_status = EXPIRED`/`REJECTED` kod SEF fakture — da li nešto treba automatski da se pokrene, ili samo upozorenje timu | `07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 6 (`buyer_acceptance_deadline`) | Trenutno sistem samo upozorava; treba potvrditi da li je to zakonski dovoljno. |

## B. Za pravnika (advokata)

| # | Pitanje | Gde se pominje | Zašto je bitno |
| :---- | :---- | :---- | :---- |
| B1 | **Ograničenje gotovinske uplate** — sistemska tvrda blokada preko 3.000 EUR je uklonjena iz aplikacije na zahtev vlasnika (avgust 2026); Zakon o sprečavanju pranja novca i dalje postoji nezavisno od toga da li ga app tehnički sprovodi | `07-SPECIFIKACIJA-M10-FINANSIJE.md` poglavlje 5.2 i 12 | Treba potvrditi da li je ručna procedura tima dovoljna za usklađenost, ili sistem ipak treba bar meko upozorenje. **Najosetljivija stavka na ovoj listi** — jedina gde je postojeća sistemska zaštita svesno uklonjena. |
| B2 | Tačan trenutak kad prihvatanje/potpis ugovora sa gostom (`ClientContract.status = ACCEPTED`) mora biti završen u odnosu na izdavanje vaučera | `21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md` poglavlje 3.3 i 8 | Trenutno se vaučer izdaje čim ugovor pređe u `GENERATED` (ne čeka `ACCEPTED`) — treba potvrditi da li je to zakonski dovoljno. |
| B3 | Da li samostalna prodaja `INSURANCE` proizvoda (bez ikakvog drugog proizvoda u rezervaciji) uopšte treba `ClientContract`, ili se rešava potpuno drugim dokumentom — posredovanje u osiguranju je zasebno regulisano van Zakona o turizmu | `21-SPECIFIKACIJA-M20-UGOVORI-KLIJENTI.md` poglavlje 8 | Nijedan postojeći `contract_type` danas ne pokriva ovaj slučaj. |
| B4 | Tačan tekst i pravni zahtevi cookie/consent banera na sajtu (M8), u skladu sa Zakonom o zaštiti podataka o ličnosti | `10-SPECIFIKACIJA-M8-SAJT-B2C.md` poglavlje 12 | Standardna GDPR-adjacent stavka, ali tekst mora biti pravno tačan, ne generički. |
| B5 | **Pristup ličnim (van-agencijskim) email nalozima zaposlenih** u M22 (ako neko koristi lični Gmail/Outlook umesto agencijskog domena) — OAuth pristanak, obim u odnosu na Zakon o zaštiti podataka o ličnosti | `25-SPECIFIKACIJA-M22-EMAIL-INBOX.md` poglavlje 10 | M22 inače pretpostavlja agencijski domen; lični nalozi su svestan izuzetak koji čeka potvrdu pre implementacije. |
| B6 | **Osiguranje od AI-generisanih grešaka** — provera sa osiguravajućim brokerom da li postojeća/buduća poslovna polisa uopšte pominje/pokriva štetu nastalu iz AI-generisanog sadržaja (od januara 2026. neki osiguravatelji to izričito isključuju iz standardnih polisa) | `31-AI-RIZIK-PRAVNA-ODGOVORNOST-OSIGURANJE-USKLADJENOST.md` poglavlje 3 | Proveriti pre nego što bilo koji M15 domenski agent pređe u `ACTIVATED` status u produkciji, ne posle prvog incidenta. |
| B7 | **Obrada ličnih podataka gosta/nalogodavca kod spoljnog LLM provajdera** — da li treba potpisan DPA, da li se podaci koriste za treniranje modela, koliko dugo se čuvaju, gde se fizički obrađuju (rezidencija podataka), i da li treba mehanizam za prenos van EU (npr. Standardne ugovorne klauzule) — pitanje se ponavlja za **svakog** provajdera pojedinačno, ne samo za trenutno izabrani (M15 §11 ostavlja izbor provajdera otvoren po agentu) | `31-AI-RIZIK-PRAVNA-ODGOVORNOST-OSIGURANJE-USKLADJENOST.md` poglavlje 5 | Proveriti pre nego što bilo koji domenski agent koji dodiruje lične podatke gosta/nalogodavca (M6, M7 subagent chat, M14, M21, M23) pređe u `ACTIVATED` status u produkciji. |

## C. Zajedničko — pravnik + zvanična dokumentacija spoljnog sistema (YUTA/CIS)

| # | Pitanje | Gde se pominje | Zašto je bitno |
| :---- | :---- | :---- | :---- |
| C1 | Tačan tehnički ugovor sa **CIS/YUTA sistemom** za registraciju garancije putovanja po rezervaciji i skidanje opterećenja pri stornu (format poziva, autentikacija) | `08-SPECIFIKACIJA-M11-COMPLIANCE.md` poglavlje 2.3 i 7 | Model podataka (`TravelGuaranteeRegistration`) je specificiran, tehnički ugovor sa CIS-om nije — isto obrazloženje kao SEF u M10. |

---

## Napomena — van obima ove liste

**MCP wire-protokol** (`17-SPECIFIKACIJA-M16-MCP-DISTRIBUCIJA.md` poglavlje 1.1/10) je slična po prirodi (tačan tehnički ugovor spoljnog standarda koji treba potvrditi neposredno pre implementacije), ali je čisto tehničko pitanje bez pravne/poreske komponente — proverava se kroz mesečni pregled trendova (Master dokument poglavlje 10), ne kroz pravnika/knjigovođu. Namerno izostavljeno odavde.

**Otvoreno poslovno pitanje (nije pravno/knjigovodstveno, samo napomena radi potpunosti):** automatski podsetnik gostu o roku opcije kod dobavljača (`06-SPECIFIKACIJA-M5-REZERVACIJE.md` poglavlje 13) čeka odluku **vlasnika**, ne stručnjaka — nije uključeno u tabele iznad.

---

## Predlog redosleda za sastanak sa stručnjakom

1. **Knjigovođa, jedan sastanak:** A1–A6 zajedno — sve se tiču SEF/ESIR/PDV/kursa, prirodno idu u istom razgovoru.
2. **Pravnik, jedan sastanak:** B1–B7 — B1 (gotovina/AML) je najurgentnija jer je postojeća zaštita već uklonjena iz sistema; B7 (LLM provajder) treba proveriti pre bilo koje aktivacije agenta koji dodiruje lične podatke, ne samo pri prvom sastanku.
3. **CIS/YUTA (C1):** može ići uz bilo koji od gornja dva sastanka, ili direktno sa YUTA predstavnikom — zavisi ko od njih dvoje ima postojeći kontakt.

Kad se stavka reši, ažurirati odgovarajuće poglavlje u izvornoj specifikaciji i obrisati red iz ovog dokumenta (ili ga premestiti u "Rešeno" sekciju po istom obrascu kao Master dokument poglavlje 11).
