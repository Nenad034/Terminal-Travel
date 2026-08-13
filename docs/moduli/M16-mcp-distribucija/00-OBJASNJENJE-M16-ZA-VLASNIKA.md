# M16 (Agentski distribucioni interfejs, MCP) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M16 dobije značajnu izmenu.

---

## Šta M16 zapravo radi

Zamislite da neko pita ChatGPT ili Google Gemini "nađi mi porodični hotel na Kopaoniku za avgust i rezerviši ga". Bez M16, taj AI asistent nema kako da vidi vašu ponudu niti da napravi rezervaciju — vi ste mu potpuno nevidljivi. M16 otvara jedan uzak, kontrolisan "prozor" kroz koji takvi spoljni AI agenti mogu da pretraže vaš katalog i, ako im to izričito dozvolite, naprave stvarnu rezervaciju — po istim pravilima kao sajt, portal za partnere ili vaš interni tim.

Ovo je isti princip kao M8 (sajt) ili M7 (portal za partnere): M16 ne pravi svoju bazu podataka niti svoja poslovna pravila. Poziva potpuno isti sistem koji već koriste svi ostali kanali — ista cena sa maržom, ista provera da li ima mesta, ista obaveza da se prikupe pravi podaci gosta pre potvrde.

## Ko sme šta — dva nivoa, i vi ručno puštate na viši

Svaki spoljni AI agent (npr. "ChatGPT integracija") se prvo mora ručno registrovati kod vas kroz interni panel. Odmah po registraciji sme samo da **gleda** ponudu — pretražuje, vidi cene, vidi status postojeće rezervacije. Ne može ništa da napravi niti promeni.

Tek kad vi (Vlasnik ili Direktor) ručno odobrite taj konkretan klijent, on dobija pravo da **stvarno rezerviše i otkazuje** u vaše ime. Ovo se nikad ne dešava samo od sebe — isti princip opreza kao odobravanje novog poslovnog partnera (M7). Svaka takva odluka se beleži u trajan zapis (ko je odobrio, kada).

## Šta se dešava kad AI agent stvarno rezerviše

Kroz isti korak-po-korak proces kao svaki drugi kanal: prvo mora da prikaže uslove putovanja i dobije potvrdu da ih korisnik prihvata (isto kao "štiklirajte da prihvatate uslove" na sajtu), zatim mora da dostavi puno ime i osnovne podatke gosta — ako nešto nedostaje, sistem odbija rezervaciju sa jasnom porukom umesto da je tiho napravi nepotpunu. Ako je kapacitet popunjen ili je kreditni limit premašen, ista provera koja bi zaustavila i vaš interni tim zaustavlja i AI agenta — nema zaobilaznog puta.

Za sada, rezervacija preko AI agenta se potvrđuje bez naplate na licu mesta (kao bankovni prenos na sajtu) — pravo plaćanje karticom kroz AI agenta je novo, brzo promenljivo tržište (kako "agenti plaćaju u ime korisnika" — standardi se menjaju iz meseca u mesec), pa smo namerno sačekali dok se to stabilizuje pre nego što uložimo u konkretno rešenje.

## Otkriven usput: stara rupa koja je pogađala i sajt, ne samo ovaj modul

Dok smo testirali M16, primetili smo da je potvrda rezervacije (korak odmah posle "rezerviši") uvek vraćala **pun**, interni prikaz — uključujući podatke o dobavljaču koje gost/spoljni agent nikad ne bi trebalo da vidi. Ovo nije nova greška napravljena za M16 — postojala je otkad je uveden bankovni prenos na sajtu (M8), samo je do sada niko nije primetio jer se retko gleda tačno taj trenutak odgovora. Ispravljeno je odmah, za oba kanala istovremeno.

## Šta namerno JOŠ nije uključeno (nije propust, čeka dalju odluku)

- **Pravi "prijavi se" mehanizam po standardu (OAuth)** — trenutno svaki registrovan klijent dobija jedan tajni ključ (kao lozinka), što je bezbedno i dovoljno za prvi krug partnera koje vi ručno odobravate. Puna, industrijska varijanta prijave (ista kakvu koriste velike platforme) je sama po sebi nedeljama posla i nije neophodna dok ne budete radili sa platformom koja to izričito traži kao uslov saradnje.
- **Plaćanje karticom kroz AI agenta** — objašnjeno iznad, tržišni standard se tek stabilizuje.
- **Automatsko upozorenje timu kad neko zloupotrebi pristup** (npr. hiljade poziva u minuti) — trenutno sistem to samo blokira na licu mesta, ne šalje vam obaveštenje. Zabeleženo za kasnije.

---

*Za tehničke detalje vidi `17-SPECIFIKACIJA-M16-MCP-DISTRIBUCIJA.md` (ovaj folder), `docs/api/M16-mcp-distribucija.md` za primere poziva, i dopunu u `06-SPECIFIKACIJA-M5-REZERVACIJE.md` (poglavlje 6.2/4.0a) za tačno šta je u M5 izmenjeno da bi M16 mogao da postoji — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
