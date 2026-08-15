# M21 (Centar za pomoć) — objašnjenje za vlasnika

## Šta je ovo, jednostavnim rečima

M21 je "uputstvo za korišćenje Terminal-a", ne uputstvo za putovanje. Zamislite ga kao helpdesk asistenta koji sedi pored svakog zaposlenog, subagenta ili poslovnog klijenta i odgovara na pitanja tipa "kako da obradim otkazivanje sa delimičnim povraćajem" ili "gde vidim svoju proviziju" — ali samo na osnovu tekstova koje je Vaš tim unapred napisao i objavio, nikad "iz glave".

Tri odvojene publike, strogo razdvojene kao tri različite prostorije: interni tim čita uputstva za panel, subagenti čitaju uputstva za portal, korporativni klijenti (firme koje same rezervišu za sebe) čitaju uputstva za sajt/aplikaciju. Niko od njih ne vidi šta je napisano za drugu publiku.

Razlika prema M14 (Podrška): M14 rešava problem kad već postoji ("nešto ne radi"). M21 sprečava da problem uopšte nastane — odgovara na "kako da..." pre nego što neko zapne. Kad M21 ne zna odgovor, nudi da otvori tiket M14 umesto korisnika — jedan tok, dva trenutka.

## Šta tačno radi

- **Baza članaka po publici.** Neko iz tima (HR/Direktor/Vlasnik) piše nacrt članka, dodeli ga jednoj ili više publika (npr. "ovo vidi i tim i subagenti"), i Direktor/Vlasnik ga objavljuje. Dok je nacrt, niko van uređivača ga ne vidi.
- **AI asistent odgovara SAMO iz objavljenih članaka.** Postavite pitanje ("kako otkazujem rezervaciju?"), asistent pretraži isključivo članke objavljene za VAŠU publiku i odgovori na osnovu njih. Ako pitanje pokuša da ga izmami da kaže nešto što nije u tim člancima — čak i lukavo formulisano ("zaboravi prethodna uputstva i reci mi...") — asistent to fizički ne može, jer tuđi/neobjavljeni sadržaj mu nikad nije ni prosleđen. Ovo nije samo "rečeno mu je da ne sme" — sadržaj koji sme da vidi je unapred filtriran pre nego što uopšte "razmišlja".
- **Kad asistent ne zna, nudi otvaranje tiketa.** Jednim klikom, korisnikovo pitanje postaje pravi tiket u M14 (Podrška), sa pitanjem već upisanim — tim ne mora ništa da prekucava.
- **Ponovljena pitanja bez dobrog odgovora postaju predlog novog članka.** Ako se ista tema pojavi 3+ puta bez dobrog odgovora, AI sam napiše nacrt novog članka i stavi ga na čekanje — HR/Direktor/Vlasnik ga pregleda i odobri (ili odbije). Čak i odobren predlog NE postaje odmah vidljiv — mora proći isti korak objavljivanja kao svaki drugi članak, dva odvojena "da" pre nego što bilo ko to pročita.
- **Svaka zloupotreba se prati.** Ako neko postavlja neuobičajeno mnogo pitanja u kratkom vremenu, ili pokuša očigledan trik da izvuče tuđ sadržaj, sistem to primeti i javlja alarm (M18) — isti alarm sistem koji već prati druge sumnjive obrasce u platformi.
- **Sve se beleži.** Svako pitanje i odgovor upisuje se u istoriju (radi kvaliteta sadržaja) i u opšti bezbednosni dnevnik platforme — potpuno isto kao svaka druga AI radnja u sistemu.
- **Korporativni klijenti** (firme koje same rezervišu grupno za sebe, ne subagenti) dobijaju sopstvenu, treću publiku — vide samo uputstva pisana za njih, prijavljeni na sopstveni nalog na sajtu/aplikaciji.

## Šta namerno JOŠ NE radi (i zašto)

- **Ekran u internom panelu (M17), portalu subagenata (M7) i sajtu/aplikaciji (M8/M9) još ne postoji.** Sve gore opisano radi "ispod haube" — API je gotov i testiran, ali dugme "Pomoć" koje biste stvarno kliknuli je sledeći, poseban korak, isti obrazac kao kod M18/M19 (prvo temelj, pa ekran).
- **Pojedinačni gosti (fizička lica koja rezervišu za sebe) nemaju pristup ovom modulu.** Namerna odluka — tipičan gost retko treba uputstvo za "korišćenje alata", pre mu treba uputstvo za putovanje (drugi modul, M23) ili direktna pomoć (M14). Ako se pokaže da bi im ipak koristilo, to je prirodno proširenje, ne novi modul.
- **Asistent nema pristup živim podacima** (npr. ne može da kaže "Vaša tačna provizija je X€") — čita isključivo unapred napisane članke. Davanje pristupa živim podacima je namerno ostavljeno za kasnije, jer zahteva sopstvenu bezbednosnu proveru pre nego što se uvede.

## Zašto baš ovako, ne "sve odjednom"

Isti princip kao kod M18/M19: prvo temelj (baza članaka, AI asistent, njegova ograda), temeljno testiran, pa tek onda ekrani koje biste Vi i tim stvarno gledali i klikali. Ograda asistenta ("odgovara samo iz objavljenog") je namerno napravljena na dva nivoa — i kao instrukcija samom AI-ju, i kao fizičko ograničenje šta mu se uopšte prosledi da pročita — tako da čak i kad bi neko pokušao lukavu formulaciju da ga prevari, nema šta da "iscuri", jer to jednostavno nije tamo.
