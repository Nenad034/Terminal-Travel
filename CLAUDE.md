# CLAUDE.md — pročitaj ovo pre bilo kakvog rada na kodu

Ovo je repozitorijum **Terminal** — poslovne platforme agencije Terminal Travel (TT). U ovoj fazi (jul 2026) repozitorijum sadrži **isključivo specifikaciju**, ne kod: Master arhitektonski dokument i Nivo 2 specifikaciju za 20 modula. Kad implementacija počne, ovo pravilo ostaje na snazi za sav kod koji se doda.

Ovaj fajl važi za **svakog AI agenta ili saradnika**, ne samo za Claude Code — ista obaveza je već upisana u `docs/00-MASTER-ARHITEKTURA.md`, poglavlje 1: "Svaki AI agent ili saradnik koji radi na bilo kom delu sistema mora prvo pročitati ovaj dokument."

---

## Struktura repozitorijuma (avgust 2026)

Dokumentacija je organizovana po foldeima da root ostane pregledan kako broj modula raste (23 fajla ravno u root-u prestalo je da bude čitljivo):

```
CLAUDE.md                    ← ovaj fajl, ostaje u root-u
tools/                       ← skripte (sync-html-overview.py)
docs/
├── 00-MASTER-ARHITEKTURA.md, 00-PREGLED-DOKUMENTACIJE.html, 01-OBJASNJENJE-TEHNICKOG-STEKA.md, ...  ← opšti dokumenti
├── analize/                 ← dokumenti koji presecaju više modula (gap-analize, validacije, otvorena pravna pitanja)
└── moduli/M<broj>-<slug>/   ← spec + sve vezano za taj modul (mape, mockupi), npr. moduli/M02-katalog-proizvoda/
```

**Ubuduće, sve što se doda za konkretan modul (spec dopuna, vizuelna mapa, mockup, analiza) ide direktno u njegov `docs/moduli/M<broj>-.../` folder — ne u root.** Novi cross-modularni dokument ide u `docs/analize/`. Novi modul dobija svoj folder pod istim obrascem (vidi listu naziva u `docs/00-MASTER-ARHITEKTURA.md` poglavlje 4 za tačan `<slug>`).

---

## Zašto ovaj fajl postoji

Vlasnik projekta (Nenad) je pre ovog projekta radio na drugoj, srodnoj aplikaciji (PrimeTravel) sa više različitih AI agenata kroz vreme, bez čvrste zajedničke strukture od početka. Rezultat: više paralelnih modula koji rade sličan posao (npr. četiri odvojena monitoring dashboard-a), fajlovi koji su prerasli u nepregledne monolite, i dosta funkcionalnosti u stanju "delimično"/"nije live" jer nije postojalo jasno "gotovo" pravilo. Vidi `docs/analize/22-ANALIZA-PRIMETRAVEL-NALAZI.md` za detaljnu analizu.

**Terminal se gradi da se ta greška ne ponovi.** Mehanizam nije "budi pažljiviji" — mehanizam je: nijedan AI agent, u nijednoj sesiji, ne sme da gradi bez oslonca na pisanu specifikaciju koju svaka buduća sesija može ponovo pročitati.

---

## Obavezan redosled čitanja pre pisanja koda

Od avgusta 2026. ovo ide kroz Skill strukturu u `.claude/skills/` umesto obaveznog čitanja celog master dokumenta u svakoj sesiji (progressive disclosure — sadržaj ostaje samo u spec fajlovima, skillovi su pokazivači na njih, ne kopije):

1. **Učitaj `tt-m<broj>-*` skill** za modul koji zadatak dotiče (npr. `tt-m5-rezervacije` za rad na M5). Skill upućuje na tačan spec fajl (`docs/moduli/M<broj>-.../0X-SPECIFIKACIJA-MY-*.md`) i na zavisnosti tog modula — nije potrebno ručno tražiti fajl preko `docs/00-PREGLED-DOKUMENTACIJE.html`.
2. **Učitaj `tt-architecture-core`** samo kad zadatak dotiče više modula odjednom, predlaže nov modul, menja arhitekturu/tok podataka, ili uključuje AI agenta sa izvršnim (ne samo asistivnim) ovlašćenjem — pun spisak slučajeva je u opisu tog skilla. Za rad unutar granica jednog već specifikovanog modula ovo nije potrebno.
3. **Učitaj `tt-tech-stack`** pre uvođenja nove tehnologije, biblioteke ili patterna koji nije već u steku.
4. Ako zadatak dotiče **više modula**, učitaj skill svakog i pročitaj svaku odgovarajuću specifikaciju — cross-reference između dokumenata (npr. "M5 poglavlje 4.1") mora ostati tačan; ako menjaš strukturu/numeraciju poglavlja u jednom dokumentu, proveri i ispravi svaku drugu specifikaciju koja na njega upućuje (`grep` po "M<broj> poglavlje" kroz sve `.md` fajlove pod `docs/` pre nego što smatraš zadatak gotovim).
5. Ceo `docs/00-MASTER-ARHITEKTURA.md` u celini se čita samo retko — kad se menja sam dokument (npr. dodaje nov modul u poglavlje 4) ili kad nijedan skill ne pokriva ono što treba.

## Tvrdo pravilo — nema koda bez oslonca u specifikaciji

- Ako je zadatak već pokriven postojećom Nivo 2 specifikacijom — implementiraj tačno po njoj.
- Ako zadatak **nije** pokriven (nov modul, nova funkcionalnost, izmena postojećeg ponašanja) — **stani pre pisanja koda**. Prvo dopuni odgovarajuću specifikaciju (ili predloži novu), dobij potvrdu vlasnika, tek onda piši kod. Ovo je isti obrazac koji je već korišćen kroz celu specifikaciju (npr. M18/M19/M20 su dodati tačno ovim redosledom: predlog → potvrda vlasnika → upis u dokument).
- Nikad ne pretpostavljaj da nešto slično već ne postoji negde drugde u sistemu — proveri `docs/00-PREGLED-DOKUMENTACIJE.html` i Master dokument poglavlje 4 pre nego što napraviš novi modul/dashboard/servis koji možda već ima mesto u postojećoj arhitekturi.

## Redosled izgradnje

Prati fazni plan iz `docs/00-MASTER-ARHITEKTURA.md` poglavlje 8 (Faza 0 → Faza 7), osim ako vlasnik eksplicitno ne kaže drugačije. Ne preskačaj zakonski prioritet Faze 2 niti redosled zavisnosti iz poglavlja 4.

## Izlazni kriterijum = definicija "gotovo"

Svaka Nivo 2 specifikacija ima sekciju "Izlazni kriterijum" sa čeklistom. Modul nije završen dok svaka stavka na toj listi ne prođe — ne "uglavnom radi", ne "UI postoji, logika ne". Ovo je direktna pouka iz PrimeTravel iskustva (mnogo funkcija u stanju "delimično"/"nije live" jer ovo pravilo nije striktno sprovođeno).

## Otvorena pitanja — jedan indeks za sve module

Svaka Nivo 2 specifikacija ima sopstvenu sekciju "Otvoreno za dalje" — to ostaje jedini izvor istine za detalje. Ali sa 22 modula, lako je izgubiti pregled šta sve čeka. `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md` je **indeks, ne kopija** — jedan red po stavci sa pokazivačem na tačan modul/poglavlje.

- Kad dodaš novu stavku pod "Otvoreno za dalje" bilo kog modula, u istom prolazu dodaj i jedan red u ovaj indeks (i obrnuto — kad se stavka reši, ukloni je odavde).
- Ako se u razgovoru pojavi ideja koja još nema jasno mesto ni u jednom postojećem modulu, upiši je u sekciju "Ideje van formalne specifikacije" na vrhu tog fajla, umesto da se izgubi kad se sesija završi.
- Ovaj fajl se čita na početku rada na bilo kojoj temi koja deluje kao da je već negde dotaknuta — brže je proveriti indeks nego ponovo "otkriti" isto pitanje.

## Ko je vlasnik i kako komunicirati

Nenad Tomić je vlasnik i **arhitekta projekta, ne programer**. Njegova uloga je vizija i nadzor sistema; posao AI agenta je da bude tim sintetičkih inženjera. Kad god je odluka tehnička (izbor biblioteke, obrazac implementacije), daj **jasnu preporuku sa obrazloženjem**, ne samo listu opcija — on ne može sam da proceni tehničke kompromise. Kad je odluka poslovna (jezici, valute, uloge, marža, poslovna pravila), pitaj — to su činjenice koje samo on zna.

## Održavanje dokumentacije

- Kad izmena u jednom dokumentu utiče na drugi (novo polje, novi događaj, promenjena numeracija poglavlja), izmeni **oba** u istom prolazu — ne ostavljaj "TODO uskladiti kasnije".
- `docs/00-PREGLED-DOKUMENTACIJE.html` je generisan iz svih spec `.md` fajlova pod `docs/`. Posle izmene bilo kog `.md` fajla, pokreni `python tools/sync-html-overview.py` iz korena repozitorijuma da se pregled osveži (mehanizam i uputstvo za nov modul su u docstring-u same skripte).
- Kad se doda nov modul (Mxx) ili promeni naziv/zavisnosti/fajl postojećeg modula (poglavlje 4 master dokumenta), dodaj ili ažuriraj odgovarajući `.claude/skills/tt-mXX-*/SKILL.md` u istom prolazu — skillovi su pokazivači na module iz poglavlja 4 i moraju ostati usklađeni s njim, isto pravilo kao za bilo koji drugi cross-reference.
- **Svaki novi dokument (spec dopuna, vizuelna mapa, mockup, analiza) ide direktno u svoj folder pod `docs/moduli/M<broj>-.../` ili `docs/analize/`, nikad u root** — vidi "Struktura repozitorijuma" iznad. Novi modul dobija svoj folder u istom prolazu kad se doda u poglavlje 4 master dokumenta.
- Ovaj repozitorijum se automatski commit-uje i push-uje na `https://github.com/Nenad034/Terminal-Travel` posle svake izmene — bez čekanja na potvrdu (dogovoreno sa vlasnikom).

## Šta ne raditi

- Ne uvoditi novu tehnologiju/biblioteku/pattern koji nije u `docs/00-MASTER-ARHITEKTURA.md` poglavlje 6 (tehnički stek) bez izričite potvrde vlasnika — promena steka nosi realnu cenu.
- Ne graditi "brzo rešenje" mimo modularnih granica iz poglavlja 3 (princip #2) — moduli pristupaju jedni drugima isključivo preko API-ja, nikad direktno u tuđu bazu.
- Ne izmišljati tehničke detalje eksternih sistema (SEF, ESIR, CIS/YUTA garancija putovanja, MCP protokol) tamo gde specifikacija eksplicitno kaže da to zahteva potvrdu knjigovođe/pravnika/zvanične dokumentacije pre implementacije — te napomene su namerne, ne propust.
