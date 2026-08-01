# Specifikacija modula M17 — Interni radni panel

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M17), poglavlje 5 (referentna arhitektura) i poglavlje 8 (Faza 0/1 — panel se pretpostavlja gotovim od tada)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje
**Verzija:** 1.1 — dodata stavka izlaznog kriterijuma za responsive prikaz (Master dokument poglavlje 5.1)
**Zavisi od:** M1. Implicitno od API-ja svakog modula koji prikazuje (M2, M3, M5, M6, M7, M9, M10, M11, M12, M13, M14, M16, M18, M19, M20 do sad specificirani).

---

## 1. Svrha i obim modula

M17 je jedan Next.js aplikacija kroz koju **ceo tim** (Vlasnik, Direktor, HR, Sales Manager, Prodajni agent, Računovođa) radi svakodnevni posao — katalog, ugovori, rezervacije, finansije, CRM, korisnici. Isti princip kao M8: **nema sopstvenu bazu ni poslovnu logiku**, čisto poziva interne API-je drugih modula. Razlika u odnosu na M8 je publika (interni tim, ne gosti) i obim (prikazuje praktično sve module, ne samo katalog/rezervacije/nalog).

M17 nije "gotov" u jednom trenutku — raste postepeno, u istom tempu u kom se moduli specificiraju i grade (poglavlje 7 ovog dokumenta).

---

## 2. Arhitektura — kompozicija nad više modula, ne nova poslovna logika

Next.js server komponente pozivaju API-je više modula i sastavljaju jedan prikaz — npr. stranica detalja rezervacije prikazuje podatke iz M5 (status, stavke), M6 (ko je gost/nalogodavac), M10 (status fiskalnog dokumenta i plaćanja) i M11 (status eTurista prijave) na jednom ekranu. Ovo je **kompozicija na nivou prikaza**, ne nova poslovna logika — M17 ne piše direktno u bazu nijednog modula, ne zaobilazi njihova pravila, samo poziva njihove već postojeće API-je i slaže odgovore u jedan ekran (princip #2 iz poglavlja 3 Master dokumenta).

Ako kompozicija postane složena (npr. mnogo poziva po jednom ekranu), dozvoljeno je da M17 ima sopstveni tanak "backend for frontend" sloj (agregacione rute unutar iste Next.js aplikacije) — ali taj sloj i dalje **samo poziva zvanične API-je** drugih modula, nikad njihovu bazu direktno.

---

## 3. Prijava i pristup

Isključivo preko M1: `account_type = STAFF`, obavezna 2FA za sve interne uloge (već odlučeno u M1 specifikaciji). Navigacija i vidljivost akcija na svakom ekranu **potpuno prate M1 model prava** (uloga + pojedinačni izuzeci) — ako korisnik nema `M5/booking/VIEW`, taj deo menija se ne prikazuje, ne samo da je onemogućen. Ovo sprečava da interfejs "curi" informaciju o postojanju podataka kojima korisnik ne sme da pristupi.

---

## 4. Struktura navigacije (raste sa fazama)

| Sekcija | Modul iza nje | Dostupno od |
| :---- | :---- | :---- |
| Korisnici i uloge | M1 | Faza 0 |
| Katalog proizvoda | M2 | Faza 1 |
| Dobavljači i ugovori | M3 | Faza 1 |
| Pretraga i rezervacije | M5 (+ M4 uživo) | Faza 1 |
| Kalendar rezervacija (dolasci/odlasci/u toku po datumu) | M5 | Faza 1 |
| Finansije (fakture, plaćanja) | M10 | Faza 2 |
| Compliance (eTurista, boravišna taksa, garancija) | M11 | Faza 2 |
| Ugovori sa klijentima | M20 | Faza 2 |
| Gosti i nalogodavci (CRM) | M6 | Faza 3 |
| B2B partneri | M7 | Faza 4 |
| Izveštaji | M13 | Faza 5 |
| Podrška | M14 | Faza 5 |
| Marketing sadržaj | M12 | Faza 6 |

Svaka sekcija se dodaje u M17 **kad odgovarajući modul dođe na red i dobije svoju Nivo 2 specifikaciju** — ovaj dokument se ne menja retroaktivno za svaki modul, sekcija se prosto doda u naviguju kad je modul spreman.

---

## 5. Kontrolna tabla (dashboard) i objedinjena upozorenja

Nekoliko modula već proizvodi sopstvena upozorenja o rokovima:
- M3: `/contracts/expiring-releases` (alotman kom se bliži rok povrata)
- M11: rok boravišne takse (do 5. u mesecu), istek garancije putovanja (YUTA)
- M1: neuspeli pokušaji prijave, zaključani nalozi

M17 početna stranica (dashboard) agregira ova upozorenja u jedan prikaz, filtriran prema ulozi (Računovođa vidi finansijske rokove, Vlasnik/Direktor vidi sve). Ovo je **čitanje iz postojećih endpoint-a više modula**, ne novi entitet ni nova baza. Ako broj ovakvih upozorenja poraste do te mere da agregacija na nivou prikaza postane nezgodna, razmotriti zaseban "Notification" modul kasnije (poglavlje 7).

---

## 6. Dozvole

M17 nema sopstveni katalog dozvola u M1 — isto obrazloženje kao M8: svaki pozvani API sam sprovodi prava pristupa. M17 samo mora da **poštuje** ta prava pri iscrtavanju interfejsa (poglavlje 3).

---

## 7. Izlazni kriterijum

Pošto M17 raste sa fazama, izlazni kriterijum je vezan za svaku fazu, ne za jedan trenutak:

- [ ] **Faza 0:** tim se prijavljuje, vidi svoju ulogu, Vlasnik/Direktor vidi audit log.
- [ ] **Faza 1:** tim može ručno da unese proizvod (M2), ugovor (M3), i da pretraži/rezerviše (M5) — ovo je doslovan izlazni kriterijum Faze 1 iz poglavlja 8 Master dokumenta.
- [ ] **Faza 2:** Računovođa može da pripremi i pošalje fiskalni dokument (M10), tim vidi status eTurista prijava i rokove boravišne takse (M11).
- [ ] Svaka naredna faza dodaje svoju sekciju bez izmene already postojećih.
- [ ] Panel se instalira kao PWA i ostaje potpuno upotrebljiv na telefonu i tabletu (fluidan raspored, ne samo skalirana desktop verzija) — Master dokument poglavlje 5.1.

---

## 8. Otvoreno za dalje

- Ako se agregacija upozorenja (poglavlje 5) pokaže nedovoljnom kad broj modula poraste (posebno posle M12/M13/M14), razmotriti zaseban modul za notifikacije/podsetnike sa sopstvenim pravilima prioriteta — trenutno namerno nije uveden dok ne postoji stvarna potreba.
- Tačan izgled/UX (raspored menija, boje, itd.) — dizajnersko pitanje van obima ove specifikacije.
