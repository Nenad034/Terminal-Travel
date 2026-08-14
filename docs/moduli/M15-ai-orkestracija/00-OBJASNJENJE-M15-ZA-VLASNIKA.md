# M15 (AI agentska orkestracija) — objašnjenje za vlasnika

## Šta je ovo, jednostavnim rečima

M15 je "pravila igre" za svaki AI agent koji ikad radi bilo šta u sistemu Terminal — šta sme sam da uradi, šta sme da predloži ali čeka Vaše odobrenje, i šta nikad ne sme da dira (novac, ugovori, licenca). Ovaj prvi prolaz ne uvodi pun AI tim po svakom modulu — to dolazi kasnije, postepeno. Uvodi samo **jednu, usko ograničenu stvar**: `Ctrl+K` polje koje je tim već koristio u M17 panelu (interni radni panel) sada ume da odgovori na stvarna pitanja na srpskom jeziku, ne samo da otvori stranicu iz menija.

Zamislite da ste do sada imali indeks pojmova na kraju knjige (brz, ali samo ako znate tačan naziv onoga što tražite) — sada dobijate i kolegu koji je pročitao istu knjigu i može da odgovori na pitanje formulisano svojim rečima ("koje rezervacije čekaju fiskalni dokument"). Kolega nikad ne piše u knjigu — samo je čita i pokazuje Vam stranicu.

## Šta tačno radi, dan za danom

- Pritisnete `Ctrl+K` u panelu (kao i do sada) i otkucate pitanje, npr. "hotel Sunčani Breg leto 2027" ili "koliko mi je ostalo do sledećeg praga provizije".
- Sistem prvo pokuša brzo, direktno poklapanje (broj rezervacije, ime gosta, naziv proizvoda) — bez ikakvog AI poziva, praktično trenutno.
- Ako to ne nađe ništa, a pitanje zvuči kao pravo pitanje na prirodnom jeziku, tek onda se poziva jezički model (AI) koji pretraži rezervacije/katalog u Vaše ime i vrati kratak odgovor sa linkovima ka pravim stranicama/zapisima.
- Prazan `Ctrl+K` + Enter i dalje radi potpuno isto kao do sada (spisak menija) — to nikad ne prolazi kroz AI, jer za to AI nije ni potreban.

## Zašto je isključeno dok Vi lično ne uključite

Ovo je namerno, ne propust. Princip koji smo primenili na svaki AI mehanizam u sistemu: **ništa se ne "budi" samo od sebe** — uvek postoji prekidač koji samo Vlasnik ili Direktor smeju da uključe, tek kad su uslovi ispunjeni. Za omnisearch, seed (početni upis u bazu) namerno ostavlja prekidač isključen (`NOT_READY`) — kod je spreman, ali ga niko automatski ne pali.

**Kako da ga uključite kad odlučite:** preko istog API-ja koji smo napravili (`PATCH /ai-orchestration/modules/M15_OMNISEARCH/activation`), dostupno isključivo Vama i Direktoru — ni AI agent, ni bilo koji drugi zaposleni, ne može sam sebi da da dozvolu, čak i kad bi neko greškom dobio pristup tom ekranu (to je namerno duplo osigurano na nivou samog koda, ne samo na nivou "ko šta vidi"). Ekran za to dugme u samom panelu (klik umesto poziva API-ja) je sledeći, mali korak — sad postoji mehanizam, treba mu samo dugme.

## Šta ovo NIKAD neće uraditi

- **Nikad ne izvršava radnju samo.** Ako pitate "otkaži mi rezervaciju TT-2027-000482", odgovor je link do te rezervacije sa dugmetom za otkazivanje na toj stranici — Vi (ili kolega) i dalje ručno kliknete i potvrdite. Ovo je testirano i sprovedeno na nivou koda (agent formalno nema nijednu dozvolu da nešto kreira, izmeni ili obriše, ni u jednom drugom modulu), ne samo napisano u uputstvu za AI.
- **Nikad ne pretražuje otvoreni internet.** Zna samo ono što već postoji u sistemu Terminal (rezervacije, katalog, dobavljači...). Pretraga spoljnih recenzija hotela sa imenovanog spiska sajtova je posebna, kasnija dopuna — nije uključena sada.
- **Nikad ne vidi više nego što bi taj konkretni zaposleni video da je sam kliktao kroz meni.** Prodajni agent koji vidi samo svoje klijente u panelu vidi samo svoje klijente i kroz `Ctrl+K` — nema "prečice" koja proširuje ono što neko sme da vidi.

## Šta se dešava iza scene svaki put kad neko postavi pitanje

Svaki upit se beleži u isti dnevnik svih izmena u sistemu (audit log) sa oznakom da je akter "AI agent", isto kao što se beleži svaka ljudska akcija — tako da uvek možete da vidite ko je (čovek ili AI) šta pitao i kad, ista transparentnost kao za sve ostalo u Terminal-u.

## Šta još nije gotovo (namerno)

- **Glasovni unos (mikrofon pored polja)** — čeka poseban, kasniji prolaz; ista logika (pitanje → isti tok → glasovni odgovor), samo dodatni sloj za snimanje/čitanje glasa.
- **Pretraga spoljnih recenzija hotela** — čeka da Vi lično sastavite spisak sajtova kojima verujete (agent sme da pita samo te sajtove, nikad slobodno pretražuje internet) — to je poslovna odluka, ne tehnička.
- **Ista pretraga za B2B portal (subagenti) i sajt (gosti)** — ovaj prolaz pokriva samo interni tim (M17); isti mehanizam se kasnije uključuje i tamo, sa užim obimom (subagent npr. ne vidi ime dobavljača, gost vidi samo svoje rezervacije).
- **Praćenje zloupotrebe** (neko pokušava sistematski da "izvuče" podatke van uobičajene upotrebe) — čeka modul M18 (operativni nadzor), koji još ne postoji u kodu.
- **Punih 22+ AI agenata po modulima** (jedan za finansije, jedan za dobavljače, itd.) — to je Faza 7 celog plana, mnogo kasnije; ovaj prvi prolaz namerno pokriva samo omnisearch jer on može da krene čim su M5 (rezervacije) i M17 (panel) stabilni, nezavisno od tog velikog koraka.

Ništa od ovoga nije propust — ista svesna odluka da se gradi po delovima koji stvarno mogu da se provere, kao i kod svakog drugog modula do sada.
