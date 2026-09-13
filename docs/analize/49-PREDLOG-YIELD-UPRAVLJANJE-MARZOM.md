# Predlog — upravljanje maržom po tražnji i popunjenosti (yield / revenue management)

**Status:** Predlog, bez koda, **čeka odluku vlasnika**. Nastao 13.9.2026. na pitanje vlasnika: _„da li imamo predviđen yield ili revenue manager u TT"_ — odgovor je bio **ne**, pa je vlasnik tražio da se napiše predlog.
**Dodiruje module:** M5 (marža i obračun — gde se pravilo primenjuje), M3 (kapacitet, rokovi, ugovori — odakle stižu ulazi), M13 (popunjenost i tražnja — merenje), M15 (AI agent koji predlaže), M17 (ekran u panelu), M7 (šta subagent vidi), M18 (alarmi i AI budžet), M8 (šta gost vidi).
**Šta je pregledano pre pisanja:** sve `.md` specifikacije pod `docs/` pretražene na „yield", „revenue management", „dinamičke cene", „pravilo cene/marže"; M5 §2.1 i §2.1a (`MarkupRule` i redosled obračuna), M3 §2.8 (kapacitet po danu, stop-sale), M3 §2.3 (`release_days_before`), M3 §4.4 (AI agent koji uređuje kapacitete na zahtev), M13 §4.4 (vremenski obrasci), M5 §3.0i (`SearchLog`), M7 §5 (šta subagent vidi od cene), M15 §6.5.6a (poređenje cena konkurencije — blokirano), master dokument poglavlje 7 (ovlašćenja AI agenata).

---

## 0. Kratko mišljenje — šta preporučujem

**Vredi uraditi, ali ne kao nov modul.** Sve što bi jedan „revenue manager" trebalo da zna Terminal već meri ili čuva; ono što nedostaje je samo **sloj koji na osnovu tih podataka pomera maržu** — i to najpre kao predlog čoveku, ne kao automatska promena cene.

Šta to znači običnim jezikom: danas marža stoji kao fiksan broj („na Splendid stavljamo 15%") koji neko ručno upiše i koji važi dok ga neko ručno ne promeni. Predlog je da marža dobije **uslov kada važi** — „15% inače, ali 22% kad je ostalo manje od 3 sobe, a 10% kad je 14 dana pre roka vraćanja alotmana popunjeno manje od polovine" — i da AI agent gleda te brojeve svaki dan i **predlaže** takve promene, a čovek ih odobrava jednim klikom. To je isti obrazac kao M3 §4.4 (agent uređuje kapacitete na zahtev, ne sam) i kao ceo model iz master dokumenta poglavlje 7: AI predlaže, čovek odlučuje.

**Zašto ne odmah puna automatika:** (1) TT ima tri dobavljačka režima (alotman, čarter, fiksni zakup) sa različitim rizikom — greška u pravilu na fiksnom zakupu košta stvaran novac, ne propuštenu priliku; (2) nema još stvarnih podataka o tražnji (M5 `SearchLog` je star nedelju dana), pa bi automatika radila nad šumom; (3) vlasnik je već izabrao obrazac „AI predlaže, čovek odobrava" za sve poteze sa finansijskom posledicom. Kad pravila prođu jednu sezonu sa ljudskim odobrenjem, automatika za usko definisane slučajeve može se dodati naknadno kao nivo 2 — bez menjanja strukture.

---

## 1. Šta danas postoji, a šta ne (pročitano u specifikacijama)

| Potrebno za yield                   | Postoji?        | Gde                                               | Napomena                                                                |
| :---------------------------------- | :-------------- | :------------------------------------------------ | :---------------------------------------------------------------------- |
| Marža po nivou (dobavljač→proizvod) | **da**          | M5 §2.1 `MarkupRule`                              | statična; ima `active_from/to` — vremenska kampanja, ali bez uslova     |
| Tačan redosled obračuna             | **da**          | M5 §2.1a (vlasnikova odluka 9.9.2026)             | marža je korak 4, posle popusta i dobavljačeve provizije                |
| Kapacitet po danu, prodato/slobodno | **da**          | M3 §2.8, mreža kapaciteta (M17 §4b)               | popunjenost alotmana po danu je poznata                                 |
| Rok vraćanja alotmana               | **da**          | M3 §2.3 `release_days_before`                     | samo za `ALLOTMENT`; kod čartera/fiksnog zakupa nema vraćanja (M3 §2.3) |
| Tražnja (koliko se traži)           | **da, sveže**   | M5 §3.0i `SearchLog`, M13 §4.4                    | meri od 8.9.2026; još nema istorije                                     |
| Ritam prodaje (booking pace)        | **delimično**   | M13 §4.4 („poslednji čas" otkazivanja, doba dana) | nema „koliko je prodato N dana pre polaska u odnosu na prošlu godinu"   |
| Cena konkurencije                   | **ne, namerno** | M15 §6.5.6a, M5 §13                               | blokirano do potvrde pravnika — ovaj predlog **ne** zavisi od toga      |
| Sloj koji pomera maržu po uslovu    | **ne**          | —                                                 | **ovo je jedina praznina**                                              |
| AI agent koji to predlaže           | **ne**          | —                                                 | obrazac postoji (M3 §4.4, M15 §6.9), agent ne                           |
| Ekran za pregled i odobrenje        | **ne**          | —                                                 | M17                                                                     |

Zaključak: nedostaje **jedan koncept** (uslovna marža) i **dve stvari oko njega** (agent koji predlaže, ekran koji odobrava). Ništa što traži nov modul ili novu tehnologiju.

---

## 2. Predlog modela — `MarkupRule` dobija uslov, ne nova tabela cena

### 2.1 Zašto dopuna `MarkupRule`, a ne nov entitet

`MarkupRule` već ima domet (`scope_type`/`scope_id`) i vremensko važenje. Yield pravilo je isto to, plus **uslov**. Ako se napravi posebna tabela „dinamičkih cena", dobijaju se dva mesta koja odlučuju o istoj cifri i sigurno pitanje „koje je jače" — tačno ona vrsta duplikata zbog koje CLAUDE.md postoji. Zato: **jedno pravilo, jedno mesto, uslov je opciono polje.**

### 2.2 Nova polja (nacrt, M5 §2.1)

| Polje             | Tip                                                                                                                        | Napomena                                                                                                                         |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `condition_type`  | enum, nullable: `OCCUPANCY_ABOVE`, `OCCUPANCY_BELOW`, `DAYS_TO_ARRIVAL_BELOW`, `DAYS_TO_RELEASE_BELOW`, `UNITS_LEFT_BELOW` | `null` = bezuslovno pravilo (današnje ponašanje, ništa se ne menja za postojeće zapise)                                          |
| `condition_value` | decimal, nullable                                                                                                          | procenat za `OCCUPANCY_*`, broj dana za `DAYS_*`, broj jedinica za `UNITS_LEFT_BELOW`                                            |
| `priority`        | integer, default 0                                                                                                         | kad više pravila istog dometa ispunjava uslov, pobeđuje najviši `priority`; pri istom — najuži domet (postojeće pravilo M5 §2.1) |
| `origin`          | enum: `MANUAL`, `AI_PROPOSED_APPROVED`                                                                                     | ko je pravilo napravio — obavezno zbog obeležavanja AI poteza (dok. 33, odeljak „obeležavanje AI poteza")                        |
| `proposal_id`     | UUID, nullable                                                                                                             | veza ka predlogu iz poglavlja 3, ako je pravilo nastalo iz predloga                                                              |

**Tvrde ograde (pišu se u spec kao pravila, ne kao preporuke):**

1. **Donja granica marže** — nijedno pravilo, ručno ni AI, ne sme da spusti maržu ispod `min_percentage` definisanog na nivou dobavljača/ugovora (novo polje na `MarkupRule` sa `scope_type = M3_SUPPLIER`/`M3_CONTRACT`). Vrednost je **poslovno pitanje** (poglavlje 6).
2. **Uslovna pravila se ne primenjuju na `FIXED_LEASE` i `CHARTER` bez izričitog uključenja** — tamo agencija već nosi pun rizik (M3 §2.3), pa je smisao yield-a obrnut (rasprodati, ne maksimizovati). Podrazumevano isključeno, uključuje se po ugovoru.
3. **Uslov se računa u trenutku sastavljanja ponude (`Quote`), i cena u ponudi je zamrznuta do isteka ponude** — gost koji dobije ponudu ne sme da vidi drugu cenu 10 minuta kasnije zato što je neko drugi rezervisao sobu. Postojeći `Quote` mehanizam (M5 §6) to već garantuje; ovde se samo eksplicitno kaže.
4. **Nikad na osnovu cene konkurencije** — dok M15 §6.5.6a stoji blokirano, nijedan `condition_type` ne sme da referiše spoljnu cenu. Namerno nema `COMPETITOR_PRICE_*` u enumu.

### 2.3 Šta se NE menja

Formula iz M5 §2.1 (`round(nabavna × (1 + %)) + fiksno`) i redosled iz §2.1a ostaju **isti**. Uslov samo bira **koje** pravilo ulazi u korak 4. Sve ostalo — popusti dobavljača, dobavljačeva provizija, provizija subagenta, lojalnost — ne dira se.

---

## 3. AI agent koji predlaže — `YieldAgent` (M15, nacrt)

**Nivo autonomije** (isti obrazac kao M3 §4.4.1):

| Akcija                                                    | Nivo                                    |
| :-------------------------------------------------------- | :-------------------------------------- |
| Čitanje popunjenosti, rokova, tražnje, postojećih pravila | samostalno                              |
| Predlog novog/izmenjenog uslovnog pravila                 | samostalno, upisuje predlog             |
| Primena pravila (upis u `MarkupRule`)                     | **isključivo posle ljudskog odobrenja** |
| Brisanje pravila                                          | nikad; može predložiti gašenje          |

**Kada radi:** jednom dnevno (zakazan posao), plus na zahtev iz panela („pogledaj Budvu za avgust"). Ne pri svakoj pretraži — to bi bio trošak u M18 AI budžetu bez smisla, jer se popunjenost ne menja iz minuta u minut.

**Šta gleda:** za svaki `ALLOTMENT` period sa `release_days_before` — dane do roka, procenat prodatog, broj pretraga za tu destinaciju/datum iz `SearchLog` u poslednjih 7 dana, dane do dolaska. Za `CHARTER`/`FIXED_LEASE` samo ako je uključeno po ugovoru.

**Šta daje — `YieldProposal` (nov entitet, M5):** domet, predloženi uslov, predloženi procenat, **obrazloženje u jednoj rečenici na srpskom** („Hunguest, 12–19.7: 14 dana do roka vraćanja, prodato 4 od 12 soba, tražnja pala 30% u odnosu na prethodnu nedelju → predlažem 10% umesto 15% do roka"), procena efekta (koliko soba/koliko evra), status `PENDING / APPROVED / REJECTED / EXPIRED`. Predlog **ističe sam** posle 48 h ako niko ne reaguje — stari predlog nad promenjenim brojevima je opasniji od nikakvog.

**Obeležavanje:** svako pravilo iz predloga nosi `origin = AI_PROPOSED_APPROVED` i `proposal_id`; M1 audit log beleži ko je odobrio. Isto pravilo kao za svaki AI potez u sistemu.

---

## 4. Ekran u panelu (M17, nacrt) — pravi se u istom prolazu kao kod, ne posle

Standing pravilo vlasnika (31.8.2026): logika bez ekrana nije gotova. Dva mesta:

1. **Kartica „Marža" na ekranu ugovora** (`/ugovori/[id]`) — lista pravila tog dometa, uslovna i bezuslovna, sa jasnom oznakom „važi sad / ne važi sad" izračunatom nad današnjim brojevima. Forma za ručno pravilo sa uslovom.
2. **Ekran „Predlozi marže"** (grupa Prodaja) — lista `YieldProposal` sa `PENDING` na vrhu; svaki red: obrazloženje, dugmad Odobri / Odbij, i šta se tačno menja (staro → novo). Oznaka AI porekla vidljiva tekstom, ne samo bojom (zamka 1.1).

Ko vidi/odobrava: nova prava `M5/markup-rule:conditional/EDIT` i `M5/yield-proposal/APPROVE` — Vlasnik, Direktor, šef prodaje; ne prodajni agent. Subagent (M7) **ništa od ovoga ne vidi** — vidi samo konačnu cenu, kao i danas (M7 §5).

---

## 5. Šta se meri da bismo znali da li radi (M13) — bez ovoga je ceo predlog vera, ne znanje

- Prihod i marža po periodu **sa** i **bez** uslovnih pravila (kontrolna grupa: periodi gde pravila nisu uključena).
- Koliko predloga je odobreno / odbijeno / isteklo — ako se 80% odbija, agent je loš i gasi se, ne popravlja se cena.
- Popunjenost na dan roka vraćanja pre i posle.

Ovo ide u M13 §4 kao nov izveštaj, tek kad prva pravila prorade.

---

## 6. Poslovna pitanja koja samo vlasnik može da odgovori (pre upisa u spec)

1. **Donja granica marže** — postoji li procenat ispod kog se nikad ne ide, i da li je isti za sve dobavljače ili po ugovoru?
2. **Gornja granica** — sme li marža u scenariju „poslednje 2 sobe" da ide na npr. 30%, ili postoji plafon iz reputacionih razloga?
3. **Subagenti i B2C** — kad se marža pomeri, važi li ista prodajna cena za subagenta (M7) i za gosta na sajtu (M8)? Danas je jedna cena; ako subagent treba da ima stabilnu cenu iz cenovnika, to je posebno pravilo.
4. **Ko odobrava** — samo Vlasnik/Direktor, ili i šef prodaje?
5. **Čarter i fiksni zakup** — želite li uopšte pravila „rasprodaje" tamo (spuštanje marže kako se polazak bliži), ili to ostaje ručna odluka?
6. **Redosled** — da li ovo ide pre M4 (spoljni provajderi) i M7 u faznom planu, ili posle prve sezone stvarnih podataka? Moja preporuka: **posle prve sezone** — pravila nad praznim `SearchLog`-om nemaju šta da gledaju, a M3 mreža kapaciteta i M13 merenja tek treba da se napune.

---

## 7. Šta se dešava kad vlasnik odluči

Ako je odgovor „da": M5 §2.1 dobija polja iz 2.2 i ograde, M15 §6.9 dobija `YieldAgent`, M17 dobija dva ekrana iz poglavlja 4, M13 §4 nov izveštaj, M18 nov signal `YIELD_PROPOSAL_EXPIRED_UNSEEN` (predlozi ističu, a niko ih ne gleda — znači da ekran ne radi svoj posao). Sve u jednom prolazu, sa unakrsnim referencama, pa tek onda kod.

Ako je odgovor „ne" ili „kasnije": ovaj dokument ostaje kao zapis da je pitanje razmotreno, i red u backlogu (27) stoji dok se ne vrati na dnevni red.
