# M24 (Ljudski resursi) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je „gotovo". Dopunjuje se kad god M24 dobije značajnu izmenu.

---

## Šta M24 zapravo radi

M24 je **kadrovska fascikla** svakog zaposlenog, u sistemu umesto u ormanu: od kada radi, na koje vreme (određeno/neodređeno, puno/nepuno), ko mu je neposredni šef, kada mu ističe probni rad ili ugovor — i **odsustva**: godišnji odmor, bolovanje, neplaćeno. Uz to vodi koliko je kome dana odmora dodeljeno za godinu, koliko je potrošio, i koliko mu je ostalo.

Namerno **nema plata** i nema ugovora o radu kao dokumenta. To je bila odluka na startu: plate su posao knjigovođe i posebnog softvera, a ugovor o radu je papir koji stoji kod pravnika. Sistem ne treba da zna ni jedno ni drugo da bi radio ono zbog čega postoji — da tim zna ko je kad tu.

## Fascikla ne postoji dok je neko ne otvori

Kad se u sistem doda nov korisnik (M1), njemu se **ne pravi** automatski kadrovska fascikla. Ona nastaje tek kad je HR, direktor ili sâm zaposleni popuni. Zato ekran za nekog novog kaže „dosije još nije popunjen" — to nije kvar, to je prazan ormar. Isti princip važi kroz ceo sistem: prazan ekran znači prazna baza, ne pokvaren kod.

## Ko šta sme — dva pravila, ne jedno

Većina modula radi na „dozvole": imaš dozvolu ili nemaš. Kadrovska evidencija je drugačija, jer svako ima **svoju**:

1. **Svoje uvek smeš.** Svaki zaposleni vidi sopstvenu fasciklu i sam traži sopstveno odsustvo — bez ikakve dozvole. Tuđu fasciklu vidi samo ko ima dozvolu (HR, vlasnik, direktor).
2. **O odmoru odlučuje šef.** Zahtev za odsustvo odobrava ili odbija **neposredni rukovodilac** te osobe (onaj ko je upisan kao „odgovara kome" u fascikli) — opet bez posebne dozvole, samo zato što je šef. HR može isto, ali kao „rezerva" sa opštom dozvolom.

Tako sistem ne traži da se za svakog šefa posebno klikću prava — dovoljno je da u fascikli piše ko kome odgovara.

## Zahtev za odmor nikad nije automatski odobren

Kad zaposleni pošalje zahtev, on je **na čekanju** dok šef ne klikne. Isto važi i kad HR unese odsustvo u nečije ime — ni tada nije automatski odobreno. Razlog: odobrenje je odluka, a odluku donosi čovek, ne unos u formu. Odbijanje **mora** imati razlog — sistem ne da da se odbije bez rečenice zašto, da se posle ne bi pitalo „a zašto mi je odbijeno".

## Stanje odmora se računa, ne pamti

Koliko je kome ostalo dana odmora sistem **ne čuva kao broj** koji bi neko mogao da pogrešno prepravi. Svaki put se izračuna iznova: dodeljeno za tu godinu (plus prenos iz prošle, ako mu nije istekao rok 30. jun) minus zbir **odobrenih** godišnjih odmora te godine. Ako za neku godinu nije uneto koliko je dodeljeno, sistem kaže „nije dodeljeno" — ne pogađa iz prethodne godine, jer bi pogrešan pogodak bio gori od praznog polja.

## Kalendar tima — svi vide ko je odsutan, ne svi vide zašto

Postoji ekran (kalendar odsustava) gde se vidi ko je kad odsutan, po poslovnici ako treba — da se pri planiranju smene ili sezone vidi ko nije tu. **Odobrena** odsustva vide svi u timu. **Zahteve na čekanju** vidi samo ko ih se tiče (sâm podnosilac, njegov šef, HR). **Napomenu** uz odsustvo („porodično", „operacija") vidi samo zaposleni, njegov šef i HR — ostalima je skrivena. To je namerno razdvajanje: „Mila nije tu 1–3. oktobra" je informacija za tim; „zašto" nije.

## Svaka izmena ostavlja trag

Ko je i kada uneo fasciklu, promenio datum ugovora, dodelio dane, tražio, odobrio ili odbio odsustvo — sve to ostaje zapisano u revizijskom dnevniku (M1), sa stanjem pre i posle. Dnevnik se ne može brisati ni prepravljati. To je isti mehanizam kao za rezervacije i fakture.

## Šta je popravljeno 18.9.2026 (posle revizije koda, dok. 50)

Otkriveno je da su forme ovog modula primale **bilo šta**: umesto broja dana moglo je da prođe slovo, umesto datuma tekst „nije datum", pa čak i **negativan broj dana** odmora — koji bi, da ga šef odobri bez čitanja, _povećao_ stanje odmora umesto da ga smanji. Uzrok je bio tehnički sitan (tela zahteva bila su opisana na način koji provera ne vidi), ali posledica nije. Sada svako polje prolazi proveru: pogrešan tip, nepoznato polje ili broj van raspona se odbijaju sa porukom koja imenuje polje, a odobrenje zahteva sa nula ili manje dana se ne može ni kliknuti. Uz to je napisana ova dokumentacija i dokumentacija za programere (`docs/api/M24-ljudski-resursi.md`), koje modul po pravilu mora da ima čim dobije kod.

## Šta još čeka (namerno, ne propust)

- **Broj dana odsustva se danas kuca ručno.** Specifikacija kaže da sistem treba sam da izbroji radne dane između dva datuma, bez vikenda i **praznika**. Za to treba spisak državnih praznika Srbije (a verski praznici zavise od zaposlenog) — i vaša odluka gde taj spisak živi: u podešavanjima agencije, ili unapred upisan po godini. Do tada sistem samo garantuje da je broj ceo i veći od nule.
- **Prenos neiskorišćenih dana** iz prošle godine (rok 30. jun) unosi HR ručno — automatika je svesno odložena, po vašoj odluci.
- **Rokovi obuka i sertifikata** — mesto u fascikli postoji, ekran i podsetnici čekaju AI HR agenta iz backloga (potvrdili ste ga 8.9.2026).
- **Koliko dugo se čuva fascikla posle odlaska zaposlenog** (zaštita podataka) — pravno pitanje, čeka pravnika (backlog M24).

---

_Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `43-SPECIFIKACIJA-M24-LJUDSKI-RESURSI.md` u istom folderu i `docs/api/M24-ljudski-resursi.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih._
