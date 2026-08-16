# M22 (Email/Inbox platforma) — objašnjenje za vlasnika

## Šta je ovo, jednostavnim rečima

Ovo je problem koji ste sami opisali: tokom noći stigne dvadesetak email upita, i tim ujutru zatiče gomilu nepročitane pošte koju mora prvo da razvrsta pre nego što uopšte počne da odgovara. M22 je centralizovan email klijent, ugrađen direktno u platformu — sva poslovna sandučad (rezervacije@, dobavljači@, i lična sandučad zaposlenih) na jednom mestu, sa AI agentom koji tokom noći (ili dok tim radi nešto drugo) svaku dolaznu poruku sažme u dve-tri rečenice i pripremi nacrt odgovora. Ujutru tim ne čita sirovu poštu — čita sažetke i pregleda gotove nacrte, samo klikne "pošalji" ili ih doradi.

## Šta tačno radi

- **Jedno mesto za svu poslovnu poštu, ne rasuto po ličnim nalozima.** Umesto da svaki zaposleni ima svoj Gmail/Outlook i tim nema uvid ko je šta obećao gostu, sva sandučad žive unutar Terminal platforme — deljena (npr. rezervacije@) i lična.
- **Niko ne vidi tuđe sanduče automatski, čak ni Vi.** Pristup se dodeljuje pojedinačno, sanduče po sanduče, osobi po osobi — ne po tituli/ulozi. Ako neko treba da vidi prepisku sa dobavljačima, neko (Vi ili Direktor) to eksplicitno dodeli. Čak i Vlasnik/Direktor moraju biti dodati na sanduče da bi videli prepisku u njemu — isti princip kao interni chat sa dobavljačima (M19) koji ste već videli.
- **AI sažima svaku dolaznu poruku i priprema nacrt odgovora — automatski, bez da neko traži.** Čim poruka stigne, AI je pročita, napiše kratak sažetak (šta gost/subagent/dobavljač zapravo traži) i pripremi predlog odgovora. Nijedan nacrt se ne šalje sam — uvek čeka da neko iz tima klikne "pošalji", isti princip kao svuda drugde u sistemu gde AI predlaže, čovek odlučuje.
- **Poseban oprez oko cene i obaveza.** Ako nacrt pominje cenu, uplatu, popust, otkazivanje, refundaciju ili bilo koju promenu rezervacije, sistem to prepoznaje na dva nezavisna nivoa — i u samoj instrukciji koju AI dobija, i posebnom proverom u kodu koja ne zavisi od toga da li se AI "ponašao kako treba". Čak i kad bi AI pogrešio i predložio da je nacrt gotov za slanje, kod ga svejedno zadržava kao nacrt koji čeka pregled — dvostruka brava, ne samo "molimo lepo".
- **Prepoznaje ko piše, sam.** Kad stigne poruka, sistem je automatski poveže sa gostom, subagentom ili dobavljačem iz Vaše baze (poklapanje po email adresi) — bez da neko ručno traži ko je to. Ako ne prepozna nikoga, samo je označi kao "ostalo", ništa se ne gubi.
- **Jedno posebno sanduče za dobavljače prepoznaje broj rezervacije iz predmeta poruke.** Kad dobavljač odgovori na Vaš zahtev za potvrdu, poruka obično sadrži oznaku poput "[REF: TT-000123]" — sistem tu oznaku prepozna i predloži vezu ka tačnoj rezervaciji/promeni na koju se odnosi. Ovo je SAMO predlog za lakše snalaženje — konačna potvrda da je dobavljač stvarno potvrdio rezervaciju i dalje se radi isključivo ručnim klikom na pravom mestu (M5), M22 tu odluku nikad ne donosi sam.
- **Prepiska se može pretvoriti u tiket jednim klikom.** Ako email prepiska preraste u nešto što treba formalno pratiti (reklamacija, složeniji zahtev), tim je jednim klikom prebacuje u sistem za podršku (M14) — ništa se ne kuca ponovo, veza ostaje zapisana u oba pravca.

## Šta namerno JOŠ NE radi (i zašto)

- **Nijedno sanduče još nije stvarno povezano na pravi email nalog (Gmail/Outlook/drugi).** Sistem je napravljen tako da čim odaberete pravog provajdera, samo se doda jedna nova "utičnica" — ostatak sistema (prepoznavanje pošiljaoca, AI sažetak, dvostruka brava oko cene) već radi i testiran je, samo čeka pravu poštu da uđe. Do tada, sistem radi sa simulacijom (nijedna prava poruka se ne šalje niti prima).
- **Pristup ličnim, van-agencijskim email nalozima zaposlenih (npr. njihov privatni Gmail) namerno nije uveden.** Ovo zahteva Vašu i pravnu/IT potvrdu pre nego što se uopšte razmatra (pitanje privatnosti zaposlenog nasuprot poslovne potrebe) — model u bazi je pripremljen da to jednog dana podrži, ali sama funkcija čeka tu potvrdu.
- **Ekran u internom panelu (M17) još ne postoji.** Sve gore opisano radi "ispod haube" — temelj je gotov i testiran, dugme koje biste Vi ili tim stvarno kliknuli je sledeći korak, isti obrazac kao kod M18/M19/M21 (prvo temelj, pa ekran).
- **Prepoznavanje dobavljača preko broja rezervacije u predmetu je pojednostavljeno u ovoj fazi** — radi tačno poklapanje po oznaci, i grublji "verovatno ovo" predlog po domenu email adrese kad oznake nema. Preciznije poklapanje (po imenu gosta, datumima) je mesto za doradu ako se u praksi pokaže da ovo nije dovoljno.

## Zašto baš ovako, ne "sve odjednom"

Isti princip kao kod ostalih modula: prvo temelj koji dokazano radi (baza, pravila pristupa, AI sažetak/nacrt sa dvostrukom bravom, testovi koji to potvrđuju), pa tek onda prava konekcija na email provajder i ekran koji tim stvarno gleda. Razlog za dvostruku bravu oko cene/obaveze je isti razlog zbog kog AI nigde u sistemu ne šalje poruku, ne potvrđuje rezervaciju, ne objavljuje sadržaj sam — predlaže, čovek odlučuje, i ta odluka je uvek vidljiva u tragu ko je šta i kada poslao.
