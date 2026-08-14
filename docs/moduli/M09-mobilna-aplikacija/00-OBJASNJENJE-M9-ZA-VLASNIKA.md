# M9 (Mobilna aplikacija) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M9 dobije značajnu izmenu.

---

## Šta je urađeno — i šta namerno nije (ažurirano avgust 2026, v1.4)

M9 je zamišljen kao jedna mobilna aplikacija sa **dva potpuno različita lica**: verzija za goste (pregled ponude, rezervacija, vaučer na telefonu) i verzija za vodiče koji su fizički na terenu sa grupom. Prvi prolaz je napravio **samo pozadinu (backend)** za vodiča — restoran je imao kuhinju, ali salu za goste još nije otvorio. **U ovom prolazu je napravljena i sama telefonska aplikacija** (React Native, alat Expo) — sala je sad otvorena, obe strane rade od početka do kraja na pravom telefonu.

Deo za goste koristi potpuno iste "recepte" (API-je) koje sajt (M8) već koristi — nema nijedne nove poslovne logike napisane samo za telefon, tačno kao što je od početka i planirano.

### Kako sada rade obadva lica aplikacije

- **Gost** se prijavi ili registruje, pretraži ponudu, izabere aranžman, prihvati uslove putovanja, plati (karticom ili uplatom na račun) i dobije potvrdu sa vaučerom koji ima QR kod — pogodan da ga neko na licu mesta (hotel, prevoznik) skenira umesto da traži papir.
- **Vodič** se prijavi (obavezna dvofaktorska prijava, isto kao ostatak internog tima), vidi svoj raspored, i za svaku turu može da odčekira goste i prijavi problem na terenu — sve to radi i **bez signala**, telefon sve pamti lokalno i pošalje čim se veza vrati.

### Obaveštenja na telefonu (novo u ovom prolazu)

Aplikacija sad ume da pošalje pravo obaveštenje na telefon (kao SMS ili poruka iz drugih aplikacija): gostu kad je rezervacija potvrđena, i vodiču kad kolega na istoj turi prijavi hitan problem. Ovo koristi besplatan servis koji dolazi sa istim alatom (Expo) kojim je napravljena sama aplikacija — nije dodat nijedan novi spoljni ugovor/vendor. Napomena: ova obaveštenja rade tek kad se aplikacija instalira kao prava aplikacija (ne u "Expo Go" probnom režimu koji se koristi za brzo testiranje tokom razvoja) — to je ograničenje samog alata, ne nešto što je ovde propušteno.

## Zašto je vodič poseban slučaj — "offline-first"

Svi ostali delovi Terminal-a pretpostavljaju da je korisnik online — prodajni agent sedi za kompjuterom sa internetom, gost pretražuje sajt sa vezom. Vodič na terenu (planina, selo bez signala, autobus u tunelu) često **nema** signal baš u trenutku kad mu je aplikacija najpotrebnija — kad treba da odčekira gosta na okupljanju ili prijavi problem.

Zato je ovaj deo napravljen po principu "offline-first" (bukvalno: "prvo radi bez interneta, veza je bonus"): kad se telefon vrati u domet signala, sve što je vodič uradio dok nije bilo veze se automatski pošalje serveru odjednom. Sistem je napravljen tako da nikad ne napravi duplikat čak i ako se ista pošiljka nehotice pošalje dvaput (npr. veza je pukla baš dok je telefon čekao potvrdu) — svaki zapis nosi svoju jedinstvenu "nalepnicu" (generisanu na samom telefonu, ne na serveru) koju server prepoznaje i ignoriše ako je već primio taj isti zapis ranije.

## Šta vodič konkretno radi (kad aplikacija bude gotova)

- **Vidi svoj raspored** — samo svoje ture, nikad tuđe. Lista gostiju sa imenima, kontaktima i napomenama (npr. alergije), i vaučer za svaku turu.
- **Prijavljuje dolazak gosta** ("check-in") — potvrđuje da je gost fizički stigao na okupljanje.
- **Piše belešku o problemu na terenu** ("incident note") — sa tri nivoa ozbiljnosti: informativna, upozorenje, ili **hitna**.

## Hitna beleška ne čeka da je neko slučajno primeti

Kad vodič označi belešku kao "hitna" (npr. "autobus se pokvario, kasnimo dva sata"), sistem to ne ostavlja da samo sedi u bazi dok neko slučajno ne pogleda. Čim se ta beleška stigne do servera (kad se telefon vrati u signal), sistem odmah:
1. Upiše to u trajni, nepromenljiv trag (isti mehanizam koji već čuva trag svake važne radnje u sistemu).
2. Pošalje "obaveštenje" kroz unutrašnji sistem signala koji je Terminal već koristi za slične hitne slučajeve (npr. kad slanje računa poreskoj upravi ne uspe). Ovaj signal je već spreman da ga budući ekran za tim (M17) ili tim-chat (M19) pokupi i pokaže odmah — ti ekrani sami još ne postoje, ali "žica" ka njima je već povezana, isti obrazac koji je Terminal koristio i za druge slične hitne signale pre nego što je M18 (nadzorni modul) bio izgrađen.

## Ko sme da bude vodič

Napravljena je nova uloga u sistemu, "Vodič" — potpuno odvojena od prodajnog agenta, menadžera i ostalih uloga. Vodič vidi isključivo svoj sopstveni raspored, ne može da uđe u interni panel (taj alat je za tim u kancelariji, ne za teren), i ne može da vidi ničije tuđe rezervacije. Ko je kome dodeljen kao vodič turi — to i dalje odlučuje tim iz kancelarije, kroz postojeći sistem rezervacija (dodat je jedan mali "prekidač" u tom sistemu baš za ovu svrhu).

## Šta još čeka (namerno, ne propust)

- **Objavljivanje u App Store/Google Play** — aplikacija radi i testira se preko Expo alata, ali još nije predata prodavnicama aplikacija (to zahteva razvojne naloge kod Apple/Google i vlasnikovu odluku o budžetu za to).
- **Prikaz hitnog upozorenja na ekranu tima u realnom vremenu** — signal se već šalje i sad i gura obaveštenje direktno na telefon drugog vodiča na istoj turi, ali dok M19 (tim-chat) ne bude izgrađen, tim u kancelariji (M17) ga još ne "hvata" automatski na svom ekranu — trenutno ostaje zapisan u trajnom tragu, proverljiv, ali ne i sam iskačući na nečijem monitoru u kancelariji.
- **Testiranje na pravom preklopnom telefonu** — raspored se prilagođava širini ekrana i lokalno je proveren simulacijom promenljive veličine prozora; pravi preklopni uređaj nije bio dostupan za fizičko testiranje.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md` u istom folderu i `docs/api/M9-mobilna-aplikacija.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
