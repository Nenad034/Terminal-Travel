# M19 (Komunikaciona platforma) — objašnjenje za vlasnika

## Šta je ovo, jednostavnim rečima

M19 je unutrašnji "Viber/WhatsApp za tim" — mesto gde zaposleni razgovaraju jedni sa drugima uživo, vide ko je online, i vide kad neko kuca poruku. Uz to, isti sistem sada nosi razgovor sa dobavljačem (npr. hotelom) kroz istu vrstu chat prozora, ali strogo ograđen — dobavljač vidi samo svoj jedan razgovor sa Vašim timom, ništa drugo. I treće: kad M18 (alarm sistem, prošli modul) primeti nešto ozbiljno, ta poruka sad stiže i ovde, kao "sistemsko obaveštenje" u ličnom razgovoru svakog Vlasnika/Direktora, pored Telegrama i emaila.

Zamislite da je do sada tim komunicirao preko telefona, mejla i papirnih beleški — sad postoji jedno mesto u aplikaciji gde to ide, uz istoriju koja se ne gubi.

## Šta tačno radi

- **Interni chat, uživo.** Dvoje zaposlenih (ili grupa) razmenjuju poruke, vide status jedni drugih (online/odsutan/offline) i "korisnik kuca..." indikator, tačno kao u WhatsApp-u.
- **Poruka ne nestaje ako niste tu.** Ako pošaljete poruku kolegi koji trenutno nije prijavljen, poruka čeka i stiže mu čim se sledeći put poveže — uz mobilno obaveštenje (push) ako koristi mobilnu aplikaciju.
- **Poseban, ograđen razgovor sa dobavljačem.** Kad tim odluči da nekom dobavljaču (npr. hotelu) da pristup jednom razgovoru, taj dobavljač dobija svoj sopstveni, minimalan nalog — vidi isključivo taj jedan razgovor, ništa drugo iz sistema (ne vidi cene, katalog, druge dobavljače, interni panel). Ovo je svesno uže od pristupa koji ima B2B subagent (M7) — dobavljač ovde samo razgovara, ne rezerviše ništa sam.
- **Ko unutar tima sme da vidi taj razgovor sa dobavljačem — bira se pojedinačno.** Nije automatski "svi prodajni agenti vide sve razgovore sa dobavljačima" — neko sa pravom (Vlasnik/Direktor/Sales Manager) svesno dodeljuje pristup po razgovoru, kao što dodeljujete pristup zajedničkom mejl sandučetu.
- **AI ume da sažme dugu prepisku sa dobavljačem i predloži nacrt odgovora** — ali ga NIKAD sam ne šalje. Zaposleni pregleda predlog, i ako mu odgovara, sam ga pošalje jednim klikom. Ako nacrt pominje cenu ili obavezu, AI to jasno naglasi da zaposleni to proveri pre slanja.
- **M18 upozorenja stižu i ovde.** Kad alarm sistem primeti nešto ozbiljno (CRITICAL), pored Telegrama i emaila, poruka stiže i kao "sistemsko obaveštenje" u ličnom razgovoru — jedno mesto manje da propustite.
- **Razgovor sa gostom/subagentom (postojeći tiketi iz M14) se prikazuje kroz isti chat izgled** — ali podaci ostaju tamo gde su i bili (M14), ovaj modul ih samo lepše prikazuje, ne duplira ih.

## Šta namerno JOŠ NE radi (i zašto)

- **Ekran u internom panelu (M17) i tab u mobilnoj aplikaciji (M9) još ne postoje.** Sve gore opisano radi "ispod haube" — API i realno vreme (WebSocket veza) su gotovi i testirani, ali dugmad/prozor za chat u panelu koji biste stvarno otvorili i koristili je sledeći, poseban korak, isti obrazac kao kod M18 (prvo temelj, pa ekran kad se zatraži).
- **Slanje pravog testa uživo (dva čoveka koji stvarno kucaju u pretraživaču)** nije još urađeno jer taj test zahteva pravi chat prozor da postoji — dolazi sa panel ekranom.
- **Dobavljač ne dobija obaveštenje van portala** (npr. email/SMS "stigla Vam je poruka") ako ne drži prozor otvoren — to je svesno ostavljeno za kasnije, dodaje se ako se pokaže da dobavljači propuštaju poruke.
- **Instalacija portala za dobavljača kao aplikacije (PWA)** nije urađena — dobavljač za sada samo otvara link koji mu pošaljete, ne "instalira" ništa. Dodaje se ako se pokaže potreba.
- **Zaštita od zloupotrebe portala** (npr. neko pokuša mnogo puta pogrešnu lozinku) nije posebno razrađena u ovom prvom prolazu — isti nivo pažnje kao za svaki drugi javni login u sistemu (B2B portal, sajt), dolazi kad se pokrene ozbiljnija bezbednosna revizija.

## Zašto baš ovako, ne "sve odjednom"

Isti princip kao kod M18: prvo se gradi temelj (baza podataka, API, veza u realnom vremenu) i to se temeljno testira, pa tek onda ekran koji Vi stvarno gledate i klikate. Razlog je jednostavan — ako se ekran gradi pre nego što je temelj proveren, rizik je da se pravi lep prozor nad nečim što u pozadini ne radi kako treba. AI nacrt odgovora dobavljaču je namerno "predloži pa čovek odobri" — nikad "AI sam pošalje" — isto pravilo koje važi svuda u sistemu gde poruka može da pomene cenu ili obavezu (isto kao komunikacija sa gostima u M6).
