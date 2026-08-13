# M7 (B2B modul: Subagenti) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M7 dobije značajnu izmenu.

---

## Šta M7 zapravo radi

Ovo je modul za poslovne partnere — turističke agencije koje preprodaju vaše aranžmane svojim klijentima ("subagenti"). Umesto da svaka takva agencija zove telefonom ili šalje mejl za svaku rezervaciju, subagent dobija svoj nalog i naručuje kroz isti sistem koji koristi vaš tim, samo sa svojom cenom (proviziju umesto marže koju vidi krajnji gost) i svojim kreditnim limitom.

Ovaj modul ne pravi nov profil za subagenta — koristi profil koji već postoji u M6 (Nalogodavci), samo mu dodaje ono što je specifično za B2B odnos: hijerarhiju (subagent može imati svoje "podagente"), proviziju, i koliko sme da duguje pre nego što mora da plati.

## Mreža sa više nivoa — ali svako vidi samo svoj deo

Subagent A može da ima svoje sopstvene subagente (B i C) koji rade preko njega. Svaki nivo vidi tačno onoliko koliko mu treba za posao:
- **Vi (agencija)** vidite ceo lanac — sve nivoe, sve rezervacije, jer vi na kraju snosite rizik ako neko ne plati.
- **Subagent A** vidi svoj profil, svoje rezervacije, i osnovne podatke o B i C (ime, status, kolika im je provizija/kredit) — dovoljno da upravlja odnosom sa njima.
- **Subagent A NE vidi** rezervacije ili goste koje su B i C napravili — to je njihov posao, ne njegov.

Kad A postavlja proviziju za B, sistem ne dozvoljava da B dobije veću proviziju nego što A sam ima — inače bi A gubio novac na svakoj prodaji koju B napravi. Ovo je automatska ograda, ne nešto što neko mora ručno da proverava.

## Kreditni limit — proverava se PRE nego što se bilo šta rezerviše

Svaki subagent ima kreditni limit koji vi (Vlasnik ili Direktor) postavljate kad ga odobrite. Kad subagent hoće da rezerviše nešto što bi ga odvelo preko tog limita, sistem to odbija **pre** nego što bilo šta rezerviše kod hotela/dobavljača — tako da se nikad ne desi da rezervišete kapacitet za prodaju koja se odmah pokaže nemogućom jer subagent nema više kredita.

Novi subagent ne može da naruči ništa dok ga ručno ne odobrite — ovo je namerna kočnica, sistem sam ne otvara kreditnu liniju nikome.

## Provizija koja raste sama — i "nadoknada unazad" kad se to desi usred perioda

Možete postaviti pragove: "ako subagent proda za 50.000 EUR u ovom kvartalu, provizija mu automatski skoči na viši procenat". Sistem sam prati koliko je subagent prodao i sam podigne proviziju čim se prag dostigne — bez da neko mora ručno da menja podešavanja.

Zanimljiv slučaj: šta ako subagent pređe prag na sredini kvartala? Da li dobija viši procenat samo na buduće prodaje, ili i na ono što je već prodao ranije u tom istom kvartalu? Ako ste to tako definisali (opcija "retroaktivno"), sistem sam izračuna koliko subagentu duguje za već ostvarenu prodaju po starom, nižem procentu — ali **ne** menja stare fakture (to je zakonski osetljivo). Umesto toga, pravi poseban obračun ("rabat") koji čeka vaše odobrenje pre nego što se primeni kao popust na sledeći račun. Sistem nikad sam ne prebacuje novac — samo priprema obračun, vi odlučujete.

## Cena za subagenta — provizija umesto popusta za lojalnost

Kad krajnji B2C gost kupuje direktno, može imati popust zbog programa lojalnosti (M6). Subagenti ne učestvuju u tom programu — umesto toga, njihova cena se računa preko sopstvene provizije. Sistem prepoznaje da li je neko subagent po tome da li **stvarno postoji** zapis za njega u ovom modulu — ne po tome da li je "firma" u opštem smislu. Obična kompanija koja kupuje direktno (nije registrovana kao vaš poslovni partner) i dalje plaća standardnu cenu, ne proviziju.

## Šta još čeka (namerno, ne propust)

- **Sam portal (web stranica na kojoj subagent radi)** — ovaj prolaz je napravio "mašineriju" (API) koja bi taj portal servisirala, ali samu stranicu (ekrane, dugmad, mobilni prikaz) još nismo gradili — isti obrazac kao M6, gde je prvo napravljen API, pa tek onda front-end kad dođe na red.
- **AI agent koji sam razgovara sa subagentom i rezerviše u njegovo ime** (poglavlje 2.0.4 specifikacije) — ovo čeka M15 (AI agentska orkestracija), modul koji još nije napravljen. Kad dođe na red, subagent će moći kroz razgovor da traži ponude i rezerviše, uz dva nivoa provere (subagent uvek mora sam da potvrdi, a veće iznose dodatno pregleda vaš tim).
- **Univerzalna pretraga** (kucanje pitanja umesto klikanja kroz meni) — isto čeka M15.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md` u istom folderu i `docs/api/M7-b2b-subagenti.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
