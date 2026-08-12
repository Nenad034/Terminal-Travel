# M11 (Regulatorni modul / Compliance) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M11 dobije značajnu izmenu.

---

## Šta M11 zapravo radi

Da agencija sme da prodaje organizovana putovanja (ne samo posreduje), zakon traži **garanciju putovanja** — polisu kod YUTA ili osiguravača, sa gornjim limitom pokrića. M11 pazi na dve stvari koje su odvojene, ali povezane: (1) da ukupna vrednost prodatih aranžmana nikad ne pređe taj limit, i (2) da svaka pojedinačna rezervacija bude prijavljena u državni CIS/YUTA registar sa sopstvenim brojem garancije. Uz to, M11 zna da na zahtev generiše čitljiv izveštaj za turističkog inspektora.

## Tvrda blokada pri 100%, upozorenje pri 80%

Kad prodajete aranžman gde ste vi organizator (ne preprodajete tuđi), sistem sabira sve takve prodaje i poredi ih sa limitom vaše trenutne garancije. Na 80% javlja upozorenje — informativno, ništa se ne blokira. Na 100% — **odbija potvrdu nove rezervacije**, pre nego što se bilo šta rezerviše kod hotela/dobavljača. Ovo nije interna politika opreza, ovo je zakonski uslov — sistem ga sprovodi automatski, ne čeka da neko primeti ručno. Testirano da se ova provera dešava pre kreditnog limita B2B partnera (kad taj modul dođe na red) — zakonska ograda ide prva.

## Šta se dešava kad garancija istekne, a nova još nije stigla

Ovo je situacija koju ste vi konkretno tražili da rešimo drugačije od "sve ili ništa": u praksi obnavljanje garancije zna administrativno da kasni. Ako bismo blokirali prodaju istog trena kad prethodna polisa istekne, prodaja bi stala svake godine na par dana bez razloga. Ako nikad ne bismo blokirali, sistem ne bi stvarno štitio zakonsku obavezu.

Rešenje: **15 dana počeka.** Čim garancija istekne, sistem odmah šalje hitno upozorenje Vlasniku/Direktoru, ali prodaja i dalje radi. Ako se garancija ne obnovi ni posle 15 dana, sistem tad zaista blokira nove ORGANIZATOR rezervacije, dok se ne unese nova polisa. Isti broj dana (15) već koristimo za rok prihvatanja e-fakture u M10 — jedan dosledan "razuman zakonski rok" kroz ceo sistem, ne izmišljen posebno za M11.

## Svaka rezervacija dobija svoj broj u državnom registru — automatski

Čim potvrdite rezervaciju gde ste organizator, sistem sam, u pozadini, pokušava da je prijavi u CIS/YUTA registar i dobije broj garancije za nju. Ovo je čisto mehanička radnja (isti princip kao kad M10 sam kreira obavezu prema dobavljaču čim se rezervacija potvrdi) — nema tu AI procene, podaci već postoje. Ako pokušaj ne uspe (npr. CIS privremeno nedostupan), sistem to vidi kao grešku i posle 48h javlja upozorenje da neko ručno proveri i, ako treba, klikne "pokušaj ponovo".

Kad rezervaciju otkažete, sistem isto tako sam pokušava da **skine** to opterećenje iz registra — otvorena "obaveza" u CIS-u koja više nema pokriće iza sebe je propust koji zakon ne dozvoljava. Ako skidanje ne uspe u roku od 48h, opet stiže upozorenje.

**Napomena:** tačan tehnički način razgovora sa CIS/YUTA sistemom (format poziva, prijava) još nije potvrđen sa zvaničnom dokumentacijom — isti razlog kao za SEF u M10. Ceo unutrašnji tok (kad se šalje, šta se dešava pri uspehu/neuspehu, alarmi) je izgrađen i testiran; samo je "poslednja milja" ka spoljnom sistemu privremeno simulirana (mock), spremna da se zameni pravim pozivom čim potvrda stigne.

## Izmena garancije je uvek ljudski klik

Sistem sam nikad ne menja podatke o garanciji (iznos, datum isteka, broj polise) — to radi samo Vlasnik ili Direktor, ručno, kroz panel. AI agent to ne sme, ni kad bi "znao" da treba obnoviti. Sistem sme samo da **primeti** i **upozori** (60/30/7 dana pre isteka) — nikad da sam deluje. Svaka takva ljudska izmena se upisuje u trag ko-je-šta-uradio (audit log), testirano da se zaista upiše sa identitetom osobe koja je kliknula.

## Izveštaj za inspekciju — trenutno tabela, ne lepo formatiran PDF

Kad inspektor zatraži uvid, sistem zna da za zadati period skupi sve relevantno iz više modula odjednom (ko je platio, koje fakture su izdate, koje rezervacije, koje garancije su registrovane) u jedan pregled. Trenutno taj pregled izlazi kao tabela koja se otvara direktno u Excel-u — radi, čitljivo je, ali nije lepo formatiran PDF dokument. Za to bi trebalo uvesti novu biblioteku u sistem, a to je nešto što po pravilu prvo tražimo vašu potvrdu pre uvođenja — nismo to uradili unapred bez pitanja.

## Šta još čeka (namerno, ne propust)

- Tačan tehnički ugovor sa CIS/YUTA sistemom (potvrda dokumentacije/pravnika pre zamene mock verzije).
- Lepo formatiran PDF/Excel izveštaj za inspekciju (čeka vaš izbor biblioteke).
- Da li M11 treba da prati i druge dozvole agencije van YUTA garancije — nije tražено, ne dodajemo dok se ne pokaže potreba.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `08-SPECIFIKACIJA-M11-COMPLIANCE.md` u istom folderu — ovaj dokument je namerno pojednostavljen, ne zamenjuje ga.*
