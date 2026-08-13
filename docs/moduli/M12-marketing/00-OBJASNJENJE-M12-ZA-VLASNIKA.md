# M12 (Marketing i sadržajni engine) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M12 dobije značajnu izmenu.

---

## Šta M12 zapravo radi

Kad se novi proizvod (hotel, aranžman) objavi u katalogu (M2), neko bi trebalo da o tome obavesti svet — objavi na Facebook-u, pošalje mejl zainteresovanim gostima, doda tekst na sajt. To je posao koji inače neko u timu radi ručno, svaki put iznova: smisli tekst, otvori Facebook, otvori mejl alat, prati šta je već objavljeno a šta nije.

M12 automatizuje prvi korak toga. Čim se proizvod objavi, sistem sam napravi **nacrt** objave — naslov i tekst izveden iz naziva i opisa proizvoda — i stavi ga u red za pregled. Niko iz tima ne mora ni da pomisli na to dok proizvod ne izađe u katalog; nacrt ga već čeka.

## Zašto AI piše nacrt, ali nikad ne pritiska "objavi"

Ovo je namerno, ne propust. AI sme da **predloži** — napiše nacrt teksta, stavi ga na kalendar — ali objava na javnim kanalima (Facebook, Instagram, sajt, mejl gostima) uvek čeka da neko iz tima (Vlasnik ili Direktor) pregleda, po potrebi ispravi, i tek onda odobri. Tek to odobrenje je ono što stvarno pušta sadržaj u svet. Ako niko ne odobri, sadržaj ostaje zaglavljen u "čeka pregled" — zauvek, ako treba.

Ovo je ista granica koja postoji na više mesta u sistemu (npr. fiskalizacija u M10, slanje ugovora gostu u M6) — AI radi pripremni posao, čovek povlači poslednji potez pre nego što nešto postane nepovratno javno ili zvanično.

## Kako izgleda tok, korak po korak

1. Proizvod se objavi u katalogu (M2).
2. M12 automatski napravi nacrt objave — naslov + tekst iz naziva i opisa proizvoda — i označi ga kao "čeka pregled".
3. Nacrt se pojavljuje u internom kalendaru (kad tim panel — M17 — bude gotov, biće tu vidljiv).
4. Neko iz tima pregleda, po potrebi doradi tekst, i odobri.
5. Ako je zakazano vreme objave u budućnosti, sistem sam objavi tačno u to vreme — bez da neko mora da sedi i čeka sat u ruci. Ako nije zakazano, objavljuje se odmah po odobrenju.

## Šta se dešava kad se sadržaj objavi

Zavisno od kanala koji je izabran za tu objavu:

- **Sajt agencije** — sadržaj postaje vidljiv čim je objavljen (sam sajt još nije izgrađen — modul M8 je namerno pauziran; kad se izgradi, ovaj deo već postoji i čeka ga).
- **Facebook / Instagram** — trenutno "probna verzija" (mock) koja simulira objavu i beleži je, umesto da stvarno gađa Facebook. Pravu konekciju treba potvrditi kasnije (koje mreže tačno, sa kojim nalogom).
- **Email** — ide isključivo gostima koji su se izričito saglasili da primaju marketinške mejlove (to je zakonska obaveza, ne izbor). Ako se objava dodatno filtrira po "tagovima" (npr. samo gosti koji vole planinski turizam), taj filter samo *sužava* ko dobija mejl — nikad ne može da doda nekoga ko se nije saglasio.
- **Mobilna aplikacija (push notifikacija)** — čeka mobilnu aplikaciju (M9), koja još nije izgrađena; za sad je samo zabeleženo da bi trebalo poslati.

## Zašto svaka objava nosi svoj "tajni kod"

Svaka objava dobija kratak, jedinstven kod (npr. `K7M2P9QZ`) koji se ubacuje u linkove ka sajtu unutar te objave. Kad gost klikne na taj link i na kraju rezerviše, kod putuje sa njim kroz ceo proces (M12 ne prati ništa posle klika — samo prosleđuje kod dalje, isto kao što bi neko prosledio broj kupona). Kasnije, izveštajni modul (M13) uporedi taj kod sa listom objava i kaže "ova rezervacija je stigla baš od te Facebook objave od prošle nedelje". Ako se kod izgubi ili ne poklopi ni sa čim, rezervacija se iskreno prikazuje kao "nepoznato poreklo" — sistem nikad ne izmišlja da zna nešto što ne zna.

## AI generisane slike — pravilo transparentnosti

Krajem jula 2026, evropska regulativa (AI Act) je počela da traži da se AI-generisan sadržaj (npr. slika napravljena veštačkom inteligencijom, ne prava fotografija) jasno označi. Srbija nije u EU, pa ovo tehnički nije zakonska obaveza za Terminal, ali strukovno udruženje (YUTA) preporučuje da se agencije koje posluju sa EU partnerima/gostima ipak toga drže. Vlasnik je prihvatio ovu preporuku kao internu politiku.

U praksi to znači: ako neko označi da objava sadrži AI-generisanu sliku (za razliku od prave fotografije hotela preuzete sa sajta dobavljača, što nije isto), sistem neće dozvoliti odobrenje te objave dok tekst ne sadrži jasnu napomenu da je slika AI-generisana. Dodatno, takva AI slika se nikad ne sme koristiti kao "baner" za konkretan proizvod — jer bi to moglo da navede gosta da pomisli da tako stvarno izgleda soba/hotel koju rezerviše, a to nije prava fotografija.

## Šta još čeka (namerno, ne propust)

- **Sajt agencije (M8)** je pauziran — deo M12 koji bi trebalo da radi zajedno sa sajtom (stranice `/o-nama`, `/blog/...`, hvatanje linka sa "tajnim kodom" kad gost stigne sa spoljne objave) je pripremljen u pozadini, ali se ne vidi dok M8 ne bude izgrađen.
- **Mobilna aplikacija (M9)** — push notifikacije su pripremljene isto tako, čekaju da aplikacija postoji.
- **Prava Facebook/Instagram konekcija** — trenutno je to "probna verzija" koja samo beleži šta bi bilo objavljeno; treba odlučiti tačno koje mreže i sa kojim nalogom pre nego što krene stvarna objava.
- **Merenje uspešnosti objava** (koliko je ljudi videlo/kliknulo na Facebook-u, koliko je mejlova otvoreno) — namerno van obima za sad; ono što M12 danas radi je samo "da li je rezervacija stigla od ove objave", ne "koliko je objava bila popularna".

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `15-SPECIFIKACIJA-M12-MARKETING.md` u istom folderu i `docs/api/M12-marketing.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
