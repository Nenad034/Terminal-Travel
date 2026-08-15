# M18 (Operativni nadzor i AI optimizacija) — objašnjenje za vlasnika

## Šta je ovo, jednostavnim rečima

Do sada je sistem imao "kontrolnu tablu" (M17 dashboard) koju neko mora ručno da otvori da bi video da li nešto nije u redu. M18 je alarm koji Vas sam pozove — ne čeka da Vi proverite, nego Vam javi čim primeti problem, gde god da ste (Telegram, email). Uz to, M18 čuva evidenciju koliko sistem troši na AI pozive i sme automatski da "smanji gas" (pređe na jeftiniji, jednostavniji model) ako se potroši više nego što ste unapred odredili.

Zamislite kućnog čuvara koji ne samo da snima kamerom (to već imate — M17 dashboard), nego Vas i pozove telefonom čim primeti nešto sumnjivo, i koji svake nedelje pošalje kratak izveštaj "sve u redu, evo šta se dešavalo" čak i kad se ništa loše nije desilo — da znate da čuvar zaista radi, ne da je isključen.

## Šta tačno radi

- **Prati kvarove kroz ceo sistem** — greške kod dobavljača (M4), neuspele uplate (M10), neuspele prijave garancije putovanja (M11), hitne beleške vodiča sa terena (M9), neuobičajeno mnogo pogrešnih lozinki (M1), nizak preostali kapacitet smeštaja (M3), probijeni rokovi naplate od gosta (M10) — sve na jednom mestu.
- **Odmah javlja** — čim primeti nešto ozbiljno, šalje poruku, ne čeka da neko otvori panel. Trenutno stvarno radi preko **Telegrama** (kad podesite bota — jednostavno, par minuta preko @BotFather na Telegramu). Email kanal je za sada samo "na probi" — piše u dnevnik šta bi poslao, ali ne šalje pravu poštu dok se ne izabere način slanja (to je mala tehnička odluka koju ćemo doneti zajedno kad dođe na red).
- **Nedeljni izveštaj** — svakog ponedeljka stiže kratak sažetak ("ove nedelje: 3 upozorenja, 1 ozbiljno") čak i kad je sve bilo mirno — da znate da nadzor radi.
- **Prati koliko dobavljač (npr. Travelgate) "radi kako treba"** — brzina odgovora, koliko puta je pukao u poslednjih 15 minuta — i javlja ako neki provajder počne loše da radi.
- **Prati potrošnju na AI** — svaki poziv veštačkoj inteligenciji (trenutno samo pretraga kroz `Ctrl+K`, M15) se beleži: koliko je koštao, koji model je korišćen. Ako postavite mesečni/dnevni budžet u evrima, sistem sam pređe na jeftiniji način rada čim se budžet potroši — ne prestaje da radi, samo postaje "štedljiviji", osim za bezbednosno osetljive stvari (te uvek dobijaju najbolji model, bez obzira na budžet — cena propuštene prevare je veća od cene par evra viška).
- **Predlozi trendova** — mesečni pregled šta se dešava u industriji (koji je do sada bio potpuno ručan) sad ima mesto u sistemu gde se nalazi upiše i čeka Vaše odobrenje pre nego što uđe u zvaničnu dokumentaciju.

## Šta namerno JOŠ NE radi (i zašto)

- **Email obaveštenja nisu stvarno povezana.** Slanje prave email pošte zahteva ili novu biblioteku ili plaćen servis (SendGrid i slično) — to je mala tehnička odluka, ali ipak odluka, pa čeka da je zajedno donesemo. Do tada, Telegram je pouzdan i besplatan način da odmah dobijate obaveštenja.
- **"U aplikaciji" obaveštenja (kroz budući interni chat) čekaju taj chat da bude izgrađen** (M19, sledeći modul na redu posle ovog).
- **AI istraživanje trendova nije autonomno.** Sistem ima mesto da se upiše nalaz i traži odobrenje, ali *pronalaženje* tih nalaza (pretraga interneta) i dalje radi čovek — pravljenje AI istraživača zahteva pristup pretrazi interneta koji trenutno nije uveden u sistem (posebna odluka za kasnije).
- **Ekran u internom panelu (M17) još ne postoji za ovo** — sve gore opisano radi "ispod haube" (API, baza, cron poslovi koji rade sami), ali još nema dugmadi/liste u panelu gde biste to sve gledali klikom. To je sledeći, mali korak kad odlučite da ga tražite.
- **Praćenje zloupotrebe pitanja AI asistenta centra za pomoć** čeka taj centar za pomoć (M21) da bude izgrađen — mesto za taj signal postoji, ali nema šta da prati dok M21 ne postoji.

## Zašto baš ovako, ne "sve odjednom"

Isti princip kao za svaki drugi deo sistema: AI se uvodi tek kad je ono što nadgleda dovoljno stabilno. M18 je tek sada napravljen, pa čak ni on sam još ne dobija AI agenta za nedeljni izveštaj (izveštaj se pravi običnim, deterministim brojanjem — "3 upozorenja, 1 ozbiljno" — a ne pisanjem preko veštačke inteligencije) dok M18 ne odradi bar jedan pun poslovni ciklus u produkciji. Isto pravilo koje je zaštitilo ostatak sistema od prevremenog "puštanja AI-ja s lanca" primenjeno je i na sam ovaj modul.
