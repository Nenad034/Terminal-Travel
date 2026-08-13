# M14 (Podrška / Helpdesk) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M14 dobije značajnu izmenu.

---

## Šta M14 zapravo radi

Do sada, ako je gost ili subagent imao problem, jedini trag u sistemu bio bi kratak zapis u M6 (CRM) tipa "zvao je, rekao je X" — bez ikakvog praćenja da li je to rešeno. M14 je pravi tiketing sistem: gost sa sajta/aplikacije i subagent sa B2B portala mogu da prijave problem, dobiju broj tiketa, i prate status dok se ne reši. Interni tim vidi sve tikete na jednom mestu, sa istorijom cele prepiske.

Razlika u odnosu na M6 "beleške o komunikaciji": beleška je "zabeležio sam da smo pričali", tiket je "ovo čeka rešenje, neko je za njega zadužen, ima rok".

## Ko vidi šta

Gost vidi isključivo sopstvene tikete — ne postoji način da vidi tiket nekog drugog gosta, čak ni ako pogodi broj tiketa (sistem se pravi da tuđi tiket ne postoji, ne kaže "nemate pravo pristupa" — tako ne otkriva ni da tiket postoji). Isto važi za subagenta. Interni tim vidi sve.

Unutar tiketa, tim ponekad ostavlja **internu belešku** — nešto što gost ne treba da vidi (npr. "ovaj gost je već tražio popust prošli put, oprez"). Te beleške su tehnički nevidljive gostu/subagentu, bez obzira što oni vide ostatak prepiske na istom tiketu.

## Reklamacije imaju zakonski rok — sistem ga sam prati

Zakon o zaštiti potrošača kaže: agencija mora da odgovori na pisanu reklamaciju u roku od 8 dana. M14 to prati sam — čim neko otvori tiket kategorije "Reklamacija", sistem odmah izračuna i upamti taj rok od 8 dana. Ako prođe 5 dana bez da je iko iz tima stvarno odgovorio, sistem to primeti sam (proverava svako jutro) i javi Vlasniku/Direktoru da je vreme da se neko time pozabavi — pre nego što zakonski rok tiho istekne. Sistem ne radi ništa "u vaše ime" posle toga (ne snižava cenu, ne raskida ugovor sam) — to je pravna posledica koju samo čovek odlučuje, sistem samo obezbeđuje da se to nikad ne zaboravi.

## Rešavanje reklamacije uz povraćaj novca — priprema se sam, šalje se ručno

Kad tim reši reklamaciju i odluči da gost dobija povraćaj novca, jednim klikom (status "Rešeno" + "povraćaj: da") sistem odmah, u pozadini, priprema **nacrt** storniranog računa u finansijskom modulu (M10) — tim ne mora ručno da otvara M10 i sve ponovo unosi. Ali taj nacrt ostaje nacrt — niko, pa ni AI, ne šalje ga stvarno poreskoj upravi/gostu dok čovek to ne potvrdi ručnim klikom u M10. Ovo je namerno dvostepeno: priprema se automatski (uštedi vreme), izvršenje ostaje ljudska odluka (finansijska greška se ne sme desiti sama).

## AI sme da napiše nacrt odgovora, ali ne i da ga pošalje ako pominje novac

Isto pravilo kao u M6: AI agent sme da pripremi nacrt odgovora gostu. Ako taj nacrt pominje cenu, obavezu, ili povraćaj novca, sistem ga tehnički ne pušta napolje dok ga neko iz tima stvarno ne pregleda i pošalje — to nije samo napisano pravilo, sprovedeno je u kodu (polje "ko je poslao" ostaje prazno dok neko iz tima to ne uradi ručno).

## Šta još čeka (namerno, ne propust)

- SLA pravila za ostale kategorije tiketa (npr. "tehnički problem otvoren duže od X sati automatski eskalira") — dodaje se ako se pokaže potreba u praksi. Reklamacija već ima zakonski rok, ne čeka ovu opštu odluku.
- Integracija sa mobilnom aplikacijom za goste (M9) — dodaje se kad taj kanal bude izgrađen.
- Kad M18 (nadzorni modul) bude izgrađen, eskalacija reklamacije će se stvarno prikazati na dashboard-u i poslati email — trenutno je signal spreman i beleži se u sistemu, ali nema još posebnog ekrana/email-a koji ga prikazuje van internog panela.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `14-SPECIFIKACIJA-M14-HELPDESK.md` u istom folderu i `docs/api/M14-helpdesk.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
