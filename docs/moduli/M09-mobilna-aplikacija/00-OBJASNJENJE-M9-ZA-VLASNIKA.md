# M9 (Mobilna aplikacija) — objašnjenje za nekoga ko ne programira

**Namena:** isto što `01-OBJASNJENJE-TEHNICKOG-STEKA.md` radi za ceo tehnički stek, ovaj dokument radi za konkretan modul, jednostavnim jezikom, bez žargona — da vlasnik projekta razume šta je stvarno napravljeno i zašto, ne samo da je "gotovo". Dopunjuje se kad god M9 dobije značajnu izmenu.

---

## Šta je urađeno u ovom prolazu — i šta namerno nije

M9 je zamišljen kao jedna mobilna aplikacija sa **dva potpuno različita lica**: verzija za goste (pregled ponude, rezervacija, vaučer na telefonu) i verzija za vodiče koji su fizički na terenu sa grupom. U ovom prolazu je napravljena **samo pozadina (backend)** za drugu polovinu — vodiča. Nema još telefonske aplikacije koju bi vodič instalirao — to je posao za kasniju fazu (Faza 6). Zamislite ovo kao izgrađenu kuhinju restorana bez još otvorene sale za goste: hrana se već može pripremiti i poslužiti, ali gost još ne sedi za stolom.

Deo za goste uopšte nije dirat u ovom prolazu — i ne treba da bude. On već postoji kroz sajt (M8) i koristiće potpuno iste "recepte" (API-je) kad mobilna aplikacija bude napravljena, bez ijedne nove poslovne logike.

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

- **Sama telefonska aplikacija (React Native)** — pozadina je gotova i testirana, ali još nema ekrana koje bi vodič dodirivao na telefonu. Ovo čeka Fazu 6 celog plana izgradnje.
- **Prikaz upozorenja na ekranu tima u realnom vremenu** — signal se već šalje, ali dok M17 (interni panel) i M19 (tim-chat) ne budu izgrađeni, niko ga još ne "hvata" na ekranu — trenutno ostaje zapisan u trajnom tragu, proverljiv, ali ne i automatski iskačući na nečijem monitoru.
- **Konkretan provajder push notifikacija** (npr. za obaveštavanje kolege vodiča o hitnoj situaciji na istoj turi) — bira se pri izgradnji same aplikacije.

---

*Za tehničke detalje (tačna imena polja, redosled provera, API pozivi) vidi `16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md` u istom folderu i `docs/api/M9-mobilna-aplikacija.md` — ovaj dokument je namerno pojednostavljen, ne zamenjuje ih.*
