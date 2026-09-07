# Server i hosting — objašnjenje za vlasnika

**Datum:** 7.9.2026
**Zašto ovaj dokument:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za tehnologije, ovaj
radi za mesto na kom će aplikacija živeti. Bez žargona.

---

## Šta je bio problem

Cela aplikacija — svih 21 modul, panel sa oko 75 ekrana, sajt sa 17 — do danas je postojala
**samo na vašem laptopu**. To znači tri stvari:

1. Niko drugi joj ne može pristupiti. Ni kolega iz kancelarije, ni gost sa telefona.
2. Ako se laptop pokvari ili izgubi, nestaje jedino radno okruženje koje postoji.
3. **Fiskalizacija i naplata karticom se ne mogu ni isprobati.** Kad izdate fiskalni račun ili
   naplatite karticu, poreska i banka ne šalju odgovor odmah — pošalju ga par sekundi kasnije,
   nazad na adresu vaše aplikacije. Laptop nema stalnu adresu na internetu. Njima nema kuda da
   se jave, pa se taj deo posla ne može ni započeti.

Zbog tačke 3, ovo nije bilo pitanje udobnosti nego **zapreka**: dok ne postoji server, dva
zakonski obavezna dela sistema ostaju simulacija.

## Poređenje

Do sada je aplikacija bila kao radnja koja postoji, sa robom na policama i kasom koja radi —
ali je sagrađena u vašem stanu. Sve funkcioniše, samo niko ne može da uđe, i pošta ne može da
donese račun jer zgrada nema adresu.

Server je adresa i lokal. Roba i kasa ostaju iste — samo se sele tamo gde su dostupne.

## Šta sam napravio danas

Nisam zakupio ništa i ništa se ne plaća. Napravio sam **opis** servera — spisak instrukcija po
kom se cela mašina napravi sama, uvek isto.

Poređenje: umesto da majstor svaki put po sećanju montira istu policu i svaki put je montira
malo drugačije, postoji nacrt. Ko god da ga uzme, dobije istu policu. Ako se polica sruši,
pravi se nova iz istog nacrta za par minuta, ne iz sećanja.

To je bila i **poslednja nezatvorena stavka Faze 0** — one prve, od koje je sve počelo. Stajala
je otvorena od avgusta, a u međuvremenu je preko nje izgrađeno svih sedam faza modula.

Konkretno, nacrt obuhvata:

- **Sam server** u Nemačkoj (zahtev iz vaše specifikacije: podaci fizički u EU).
- **Bravu na ulazu.** Spolja su otvorena tačno tri ulaza: sajt, panel i API. Sve ostalo je
  zatvoreno. Ulaz za administraciju je ograničen na poznate adrese i ne prima lozinku — samo
  ključ, koji se ne može pogoditi pokušavanjem.
- **Odvojen disk za bazu.** Server se sme obrisati i napraviti iznova; podaci pri tom ostaju.
- **Automatsko zaključavanje.** Sistem sam preuzima bezbednosne zakrpe i sam blokira adrese
  koje pokušavaju da provale.
- **Dnevnu rezervnu kopiju baze**, šifrovanu pre nego što napusti mašinu, i poslatu na drugo
  mesto. Kopija koja stoji na istoj mašini ne pomaže kad se izgubi baš ta mašina.
- **Nedeljni dokaz da kopija zaista radi.** Ovo je najvažnija stavka i objašnjavam je posebno.

## Zašto se rezervna kopija proverava, a ne samo pravi

Vaša specifikacija (poglavlje 9) traži backup koji je _„testiran — periodično se proverava da
li se iz njega zaista može oporaviti sistem"_. To nije formalnost.

Najčešći način da se izgube podaci nije nepostojanje kopije. Najčešći je kopija koja se pravi
svaki dan mesecima, niko je nikad ne otvori, a onda se u trenutku kad zatreba ispostavi da je
prazna, pokvarena ili nepotpuna. Do tada je izgledala kao sigurnost, a bila je pretpostavka.

Zato jednom nedeljno sistem uzme poslednju kopiju, napravi **praznu privremenu bazu sa strane**,
vrati kopiju u nju, prebroji koliko je zapisa stiglo, i tek onda je obriše. Pravu bazu ne dira.
Ako broj ne valja ili kopija ne može da se otvori — javlja grešku odmah, a ne onog dana kad
vam zatreba.

## Koliko košta

Cene sam proverio 7.9.2026 iz dva izvora. Bitno: Hetzner je tokom 2026. dizao cene dvaput
(april i jun), pa su neki paketi poskupeli i do tri puta. Zato biram jeftiniju liniju, koja je
za naš obim sasvim dovoljna.

| Stavka                                       | Mesečno      |
| :------------------------------------------- | :----------- |
| Server CX33 (4 jezgra, 8 GB memorije, 80 GB) | 8,49 €       |
| Odvojen disk za bazu, 50 GB                  | ~2,86 €      |
| Automatske kopije celog servera (20% cene)   | ~1,70 €      |
| Stalna internet adresa                       | 0,50 €       |
| **Ukupno, testno okruženje**                 | **~13,55 €** |

Kad se pređe na pravi rad, preporučujem odvojen server za bazu (da opterećenje sajta ne usporava
podatke) — tada je ukupno **oko 27 € mesečno**. Domen se plaća posebno, jednom godišnje, obično
10–15 €.

Dve stvari koje ne mogu ja da rešim:

- **Porez.** Kupovina je iz Nemačke na srpsku firmu. To ima poresko rukovanje koje mora da
  potvrdi vaš knjigovođa — ja tu ne pogađam.
- **Domen.** Ne znam da li TT već ima registrovan domen i ko njime upravlja. Recite mi, i
  uklopiću ga; ako ga nema, predložiću varijante.

## Šta sam usput našao i popravio

Dve greške koje bi pukle tek na serveru, a do danas ih niko nije mogao videti — jer produkcijski
režim nikad nije bio pokrenut:

1. **Komanda za pokretanje pokazivala je na pogrešan fajl.** Aplikacija se u produkcijskom
   režimu ne bi ni upalila. Ispravljeno.
2. **Baza podataka ne bi radila u zapakovanoj verziji.** Nedostajala je jedna sistemska
   komponenta koju alat za bazu traži. Otkriveno tako što sam zapakovanu aplikaciju **stvarno
   pokrenuo**, umesto da pretpostavim da radi. Ispravljeno i ponovo provereno: javni katalog
   odgovara ispravno, a zaštićena stranica bez prijave odbija pristup — kako i treba.

Takođe sam smanjio paket aplikacije sa 2,38 GB na 859 MB. Ispostavilo se da je u paket API-ja
ulazilo preko 600 MB alata koji pripadaju sajtu i mobilnoj aplikaciji, a API ih nikad ne
koristi. To je razlika između slanja koje traje minutima i onog koje traje sekundama, pri
svakoj izmeni.

## Šta još NIJE dokazano

Da budem precizan, jer je lako pomešati „napisano" i „proverено":

- Pakovanje aplikacije i opis servera su **provereni** — slika je izgrađena i pokrenuta, opis
  servera je prošao formalnu proveru ispravnosti.
- **Sam server, HTTPS sertifikat i obe skripte za rezervne kopije nisu još nijednom izvršeni** —
  jer server ne postoji. Prvi put će se izvršiti kad kažete „kreni". Do tada ih vodim kao
  napisane, ne kao gotove.
