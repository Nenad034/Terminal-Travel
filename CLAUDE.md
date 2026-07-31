# CLAUDE.md — pročitaj ovo pre bilo kakvog rada na kodu

Ovo je repozitorijum **Terminal** — poslovne platforme agencije Terminal Travel (TT). U ovoj fazi (jul 2026) repozitorijum sadrži **isključivo specifikaciju**, ne kod: Master arhitektonski dokument i Nivo 2 specifikaciju za 20 modula. Kad implementacija počne, ovo pravilo ostaje na snazi za sav kod koji se doda.

Ovaj fajl važi za **svakog AI agenta ili saradnika**, ne samo za Claude Code — ista obaveza je već upisana u `00-MASTER-ARHITEKTURA.md`, poglavlje 1: "Svaki AI agent ili saradnik koji radi na bilo kom delu sistema mora prvo pročitati ovaj dokument."

---

## Zašto ovaj fajl postoji

Vlasnik projekta (Nenad) je pre ovog projekta radio na drugoj, srodnoj aplikaciji (PrimeTravel) sa više različitih AI agenata kroz vreme, bez čvrste zajedničke strukture od početka. Rezultat: više paralelnih modula koji rade sličan posao (npr. četiri odvojena monitoring dashboard-a), fajlovi koji su prerasli u nepregledne monolite, i dosta funkcionalnosti u stanju "delimično"/"nije live" jer nije postojalo jasno "gotovo" pravilo. Vidi `22-ANALIZA-PRIMETRAVEL-NALAZI.md` za detaljnu analizu.

**Terminal se gradi da se ta greška ne ponovi.** Mehanizam nije "budi pažljiviji" — mehanizam je: nijedan AI agent, u nijednoj sesiji, ne sme da gradi bez oslonca na pisanu specifikaciju koju svaka buduća sesija može ponovo pročitati.

---

## Obavezan redosled čitanja pre pisanja koda

1. **`00-MASTER-ARHITEKTURA.md`** — u celini. Ovo je "ustav" — pet arhitektonskih principa (poglavlje 3), mapa modula (poglavlje 4), model upravljanja AI agentima (poglavlje 7), fazni plan (poglavlje 8).
2. **`0X-SPECIFIKACIJA-MY-*.md`** za tačno onaj modul koji se dotiče. Fajlovi su numerisani redosledom kojim su pisani, ne redosledom modula — koristi `00-PREGLED-DOKUMENTACIJE.html` (navigabilan pregled sa linkovima) ili `00-MASTER-ARHITEKTURA.md` poglavlje 4 da nađeš pravi fajl za modul.
3. Ako zadatak dotiče **više modula**, pročitaj specifikaciju svakog — cross-reference između dokumenata (npr. "M5 poglavlje 4.1") mora ostati tačan; ako menjaš strukturu/numeraciju poglavlja u jednom dokumentu, proveri i ispravi svaku drugu specifikaciju koja na njega upućuje (`grep` po "M<broj> poglavlje" kroz sve `.md` fajlove pre nego što smatraš zadatak gotovim).

## Tvrdo pravilo — nema koda bez oslonca u specifikaciji

- Ako je zadatak već pokriven postojećom Nivo 2 specifikacijom — implementiraj tačno po njoj.
- Ako zadatak **nije** pokriven (nov modul, nova funkcionalnost, izmena postojećeg ponašanja) — **stani pre pisanja koda**. Prvo dopuni odgovarajuću specifikaciju (ili predloži novu), dobij potvrdu vlasnika, tek onda piši kod. Ovo je isti obrazac koji je već korišćen kroz celu specifikaciju (npr. M18/M19/M20 su dodati tačno ovim redosledom: predlog → potvrda vlasnika → upis u dokument).
- Nikad ne pretpostavljaj da nešto slično već ne postoji negde drugde u sistemu — proveri `00-PREGLED-DOKUMENTACIJE.html` i Master dokument poglavlje 4 pre nego što napraviš novi modul/dashboard/servis koji možda već ima mesto u postojećoj arhitekturi.

## Redosled izgradnje

Prati fazni plan iz `00-MASTER-ARHITEKTURA.md` poglavlje 8 (Faza 0 → Faza 7), osim ako vlasnik eksplicitno ne kaže drugačije. Ne preskačaj zakonski prioritet Faze 2 niti redosled zavisnosti iz poglavlja 4.

## Izlazni kriterijum = definicija "gotovo"

Svaka Nivo 2 specifikacija ima sekciju "Izlazni kriterijum" sa čeklistom. Modul nije završen dok svaka stavka na toj listi ne prođe — ne "uglavnom radi", ne "UI postoji, logika ne". Ovo je direktna pouka iz PrimeTravel iskustva (mnogo funkcija u stanju "delimično"/"nije live" jer ovo pravilo nije striktno sprovođeno).

## Ko je vlasnik i kako komunicirati

Nenad Tomić je vlasnik i **arhitekta projekta, ne programer**. Njegova uloga je vizija i nadzor sistema; posao AI agenta je da bude tim sintetičkih inženjera. Kad god je odluka tehnička (izbor biblioteke, obrazac implementacije), daj **jasnu preporuku sa obrazloženjem**, ne samo listu opcija — on ne može sam da proceni tehničke kompromise. Kad je odluka poslovna (jezici, valute, uloge, marža, poslovna pravila), pitaj — to su činjenice koje samo on zna.

## Održavanje dokumentacije

- Kad izmena u jednom dokumentu utiče na drugi (novo polje, novi događaj, promenjena numeracija poglavlja), izmeni **oba** u istom prolazu — ne ostavljaj "TODO uskladiti kasnije".
- `00-PREGLED-DOKUMENTACIJE.html` je generisan iz svih `.md` fajlova (vidi build skriptu korišćenu ranije u historiji projekta) — ako se doda nov modul, ubaci ga i u naslovnu navigaciju tog pregleda.
- Ovaj repozitorijum se automatski commit-uje i push-uje na `https://github.com/Nenad034/Terminal-Travel` posle svake izmene — bez čekanja na potvrdu (dogovoreno sa vlasnikom).

## Šta ne raditi

- Ne uvoditi novu tehnologiju/biblioteku/pattern koji nije u `00-MASTER-ARHITEKTURA.md` poglavlje 6 (tehnički stek) bez izričite potvrde vlasnika — promena steka nosi realnu cenu.
- Ne graditi "brzo rešenje" mimo modularnih granica iz poglavlja 3 (princip #2) — moduli pristupaju jedni drugima isključivo preko API-ja, nikad direktno u tuđu bazu.
- Ne izmišljati tehničke detalje eksternih sistema (SEF, ESIR, eTurista, MCP protokol) tamo gde specifikacija eksplicitno kaže da to zahteva potvrdu knjigovođe/pravnika/zvanične dokumentacije pre implementacije — te napomene su namerne, ne propust.
