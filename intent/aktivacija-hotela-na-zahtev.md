# Namera (Intent): Dinamička (de)aktivacija hotela kod TravelgateX posrednika

## 1. Metapodaci

* **Naziv:** Aktivacija hotela po stvarnoj tražnji, umesto trajne aktivacije svih hotela
* **Inicijator:** Nenad Tomić
* **Datum kreiranja:** 2.9.2026.
* **Status:** Predloženo (Proposed) — čeka odgovor posrednika pre nego što se odluči dalji tok
* **Prioritet:** Srednji (operativni trošak, ne blokira ništa hitno)
* **Napomena o obimu — VAN Terminal Travel (TT) arhitekture.** Ovo se tiče **trenutne operativne aplikacije** koju agencija danas koristi, ne sistema Terminal koji se gradi po `docs/00-MASTER-ARHITEKTURA.md`. Ovaj fajl je prvi probni primer `intent.md` koraka (vidi Dodatak A, zapis 2.9.2026, master dokument) — testira se sam format, ne dodaje se ništa u TT specifikaciju.

---

## 2. Problem i motivacija

Trenutna aplikacija je povezana na TravelgateX preko posredničke IT kompanije, **pull konekcijom** (mi zovemo njih kad nam zatreba, ne obrnuto). Posrednik naplaćuje **1 EUR mesečno po svakom "aktivnom" hotelu** u sistemu. Uz ~2000 aktivnih hotela, to je ~2000 EUR mesečno.

Po objašnjenju posrednika, cena je posledica zauzetosti njihovog servera — periodičnog povlačenja podataka od dobavljača i "watching" procesa po hotelu. Realna pretpostavka je da veliki deo od 2000 hotela nema (ili ima zanemarljiv) stvaran promet — gost ih retko ili nikad ne pretražuje niti rezerviše — pa se plaća paušalno za kapacitet koji se ne koristi.

Cilj: naći model gde se plaća srazmerno stvarnoj upotrebi, a da to bude prihvatljivo i posredniku (manje opterećenje na njihovom serveru za neaktivne hotele), ne samo pritisak na cenu sa naše strane.

---

## 3. Željeno ponašanje

* **Tri sloja hotela po važnosti**, ne samo uključen/isključen:
  1. **Core (stalno aktivni)** — hoteli koji nose najveći deo prometa (očekivano: mala grupa hotela nosi veliku većinu rezervacija). Ostaju trajno aktivni.
  2. **Sezonski aktivni** — hoteli sa jasnim sezonskim obrascem tražnje. Aktiviraju se unapred, pre sezone, na osnovu prošlogodišnjih podataka; deaktiviraju se posle sezone.
  3. **Na zahtev** — svi ostali. Podrazumevano neaktivni; aktiviraju se tek kad se pojavi stvarna pretraga za tu destinaciju/hotel (ako brzina aktivacije to dozvoljava — vidi otvoreno pitanje ispod).
* Proces koji periodično (npr. nedeljno/mesečno) čita logove pretraga i rezervacija iz trenutne aplikacije, računa raspored po slojevima i primenjuje ga preko posrednikovog API-ja/portala za (de)aktivaciju.
* **Bezbednosna ograda:** nijedan hotel se ne sme deaktivirati ako ima otvorenu rezervaciju, upit u toku ili potvrđen budući boravak.
* **Prvi mesec — samo predlog, bez izvršenja.** Sistem/agent predlaže listu ("ovih X hotela bih isključio, ušteda Y EUR"), čovek ručno pregleda i odobrava pre nego što se bilo šta stvarno menja. Automatska primena se uvodi tek posle provere da lista ima smisla.

---

## 4. Kriterijumi uspeha

- [ ] Dobijen odgovor posrednika o brzini aktivacije/deaktivacije hotela preko njihovog API-ja/portala (sekunde/minuti/sati) — vidi otvoreno pitanje 1.
- [ ] Dobijen odgovor posrednika o tačnom modelu naplate (stanje na dan obračuna / prosek / maksimum u mesecu) i o eventualnom minimalnom periodu naplate po aktivaciji.
- [ ] Napravljena prva analiza stvarne tražnje: koliko od ~2000 hotela nije imalo nijednu pretragu/rezervaciju u poslednjih 90 dana (uz uvažavanje sezonalnosti).
- [ ] Prvi predlog liste za deaktivaciju pregledan i odobren od vlasnika, sa procenjenom mesečnom uštedom.
- [ ] (ako se ide dalje) Dogovoren novi model naplate sa posrednikom koji odražava stvarnu upotrebu, ne paušal po svim hotelima.

---

## 5. Tehnički kontekst i ograničenja

* **Konekcija:** TravelgateX preko posredničke IT kompanije, pull princip (mi inicijalno zovemo njih po potrebi).
* **API/portal za (de)aktivaciju hotela postoji kod posrednika** (potvrđeno 1.9.2026, razgovor sa vlasnikom) — pitanje je samo brzina i uslovi korišćenja, ne postojanje mogućnosti.
* **Logovi pretraga i rezervacija postoje u trenutnoj aplikaciji** (potvrđeno 1.9.2026) — tačna baza/format još nije pregledan.
* Mejl posredniku sa pitanjima o brzini aktivacije, ograničenjima učestalosti, minimalnom periodu naplate i tačnom modelu obračuna je formulisan 1.9.2026 (vidi istoriju razgovora) — status slanja/odgovora još nepoznat u trenutku pisanja ovog fajla.

---

## 6. Otvorena pitanja za diskusiju

1. **Brzina (de)aktivacije** — ako je sporo (minuti/sati), sloj "na zahtev" ne može raditi u realnom vremenu za pretragu gosta; potrebna alternativa (npr. samo za ručne upite osoblja, ili šira sezonska aktivacija umesto pojedinačne po hotelu).
2. **Tačan model naplate** — snapshot na dan obračuna, prosek, ili maksimum u mesecu; ovo direktno određuje strategiju (da li ima smisla kratko aktivirati hotel za jednu pretragu, ili se to i dalje naplaćuje kao pun mesec).
3. **Ograničenje učestalosti poziva** ka API-ju za (de)aktivaciju — da li postoji limit koji bi sprečio čest toggle po hotelu.
4. **Gde tačno žive logovi pretraga/rezervacija** u trenutnoj aplikaciji (baza, tabela/format) — potrebno da bi se demand-scoring uopšte mogao implementirati.
5. **Da li posrednik uopšte pristaje na diferenciran model naplate** (npr. niža cena ili naplata po pozivu za "na zahtev" sloj) — ovo je poslovni pregovor, ne samo tehničko pitanje, i ishod određuje da li se ideja dalje razrađuje ili ostaje kod ručnog jednokratnog čišćenja liste hotela.
