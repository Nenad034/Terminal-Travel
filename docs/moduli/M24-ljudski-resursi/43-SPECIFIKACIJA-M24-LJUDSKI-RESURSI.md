# Specifikacija modula M24 — Ljudski resursi

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M24) i poglavlje 8 (poprečan modul, bez fiksne faze)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj, uz izuzetak tačno navedenih mesta gde je potrebna potvrda pravnika/knjigovođe pre implementacije (poglavlje 7)
**Status:** Nacrt za usvajanje
**Verzija:** 1.1 — dopuna (8.9.2026, isti dan): vlasnik uklonio link ka ugovoru o radu iz obima ("Uklonite link za ugovor o radu") i uklonio `REFERENT_PRODAJE` kao zasebnu ulogu ("Uklonite referenta prodaje, neka ostane samo agent prodaje") — prodajna hijerarhija sad ima samo jedan nivo (`PRODAJNI_AGENT`, prikazno "Agent prodaje"), ne dva. `employment_contract_url`/poglavlje 3/`VIEW-CONTRACT` dozvola i sve povezane stavke izlaznog kriterijuma/otvorenih pitanja uklonjeni. v1.0 — prvi zapis (8.9.2026), na zahtev vlasnika: "svakom zaposlenom treba da dodelimo ulogu [...] treba i da postoji link prema ugovoru o radu [...] želim ovaj deo da uredimo po evropskim i svetskim standardima". Predlog nastao u razgovoru (Master dokument v1.25), ovaj dokument ga razrađuje u Nivo 2 detalje.
**Zavisi od:** M1 (identitet, uloge/RBAC — HR dosije je vezan 1:1 na `User`, nove sistemske uloge žive u M1 katalogu). Meko od M18 (dostava podsetnika o rokovima) i M15 (AI HR agent) — bez njih modul radi kao čista evidencija, samo bez automatskih podsetnika.

---

## 1. Svrha i obim modula

M24 čuva **HR dosije zaposlenog** — organizacionu poziciju, ključne datume radnog odnosa, evidenciju godišnjeg odmora/odsustava i rokove obuka/sertifikata. Cilj je praćenje rokova koje niko ne sme da propusti (probni rad, istek ugovora na određeno, godišnji odmor).

**Namerno van obima:**

- **Payroll** (obračun plate, bankovni računi, poreske prijave) — ostaje u specijalizovanom knjigovodstvenom softveru. TT nije računovodstveni servis; mešanje payroll-a u sistem bi povuklo ozbiljnu bezbednosnu/pravnu težinu (bankovni podaci, poreski identifikatori) bez jasne koristi, i duplirao bi izvor istine koji već postoji negde drugde.
- **Link/dokument samog ugovora o radu** — bio u prvom nacrtu (v1.0), uklonjen na vlasnikov zahtev (8.9.2026). Ugovor o radu ostaje van sistema, gde god se danas čuva.
- **Regrutacija/oglasi za posao** — ako se pokaže potreba, zaseban predlog.
- **Formalni workflow odobravanja odsustva** (zahtev → odobrenje pretpostavljenog → obaveštenje) — prvi prolaz je čista evidencija (HR/Vlasnik/Direktor upisuje), radni tok ide u "Otvoreno za dalje" dok se ne pokaže da je ručni unos nedovoljan.

M24 ne duplira RBAC — sistemske uloge i mehanizam dodele/uklanjanja ostaju u M1 (`/korisnici/[id]`, već postojeći `RoleAssignment`), M24 samo **dodaje nove uloge u taj katalog** (poglavlje 2.1) i **dodaje HR podatke** koji u M1 nikad nisu bili u obimu (M1 spec §3.9c izričito kaže "logo kao slika... i bilo kakav pojam 'više agencija'" van obima — HR dosije nikad nije ni bio pomenut kao mogući obim M1, princip "moduli su granice" važi i ovde: M1 = pristup, M24 = radni odnos).

---

## 2. Model podataka

### 2.1 Nove M1 sistemske uloge (dopuna `SYSTEM_ROLES`, isti obrazac kao SUBAGENT_ADMIN/VODIC dodate pri M7/M9)

Postojeće uloge (`VLASNIK`, `DIREKTOR`, `HR`, `SALES_MANAGER`, `PRODAJNI_AGENT`, `RACUNOVODJA`) se **ne brišu ni ne preimenuju** — nova hijerarhija se dodaje pored njih, da se ne pokvari nijedna postojeća dozvola/seed/test koji već zavisi od tačnog imena uloge (`grep -rn "PRODAJNI_AGENT\|SALES_MANAGER" apps/api/src` pre implementacije, da se vidi stvaran broj mesta).

| Tražena uloga (vlasnikova lista) | Odluka | Napomena |
| :--- | :--- | :--- |
| Vlasnik | `VLASNIK` (postojeća) | bez izmene |
| Direktor | `DIREKTOR` (postojeća) | bez izmene |
| Finansijski direktor | **nova: `FINANSIJSKI_DIREKTOR`** | iznad `RACUNOVODJA` u hijerarhiji ovlašćenja (M10 dozvole veće od računovođe, uže od Direktora) — tačan skup M10/M13 dozvola dogovara se pri implementaciji |
| Računovođa | `RACUNOVODJA` (postojeća) | bez izmene |
| Menadžer prodaje | `SALES_MANAGER` (postojeća) | bez izmene naziva u kodu; prikazni naziv u HR ekranu može biti "Menadžer prodaje" bez izmene same konstante (vidi napomenu ispod) |
| Šef poslovnice | **nova: `SEF_POSLOVNICE`** | **kombinovana uloga — vidi ogradu ispod, nikad samostalna** |
| Agent prodaje | `PRODAJNI_AGENT` (postojeća) | bez izmene naziva u kodu. Jedini nivo u prodajnom timu ispod Menadžera prodaje — vlasnik uklonio raniji predlog dvoslojne hijerarhije ("Referent"/"Samostalni referent", 8.9.2026: "uklonite referenta prodaje, neka ostane samo agent prodaje") |

**Prikazni naziv uloge (dopuna, van obima ove verzije, upisano da se ne izgubi):** role badge u panelu danas prikazuje doslovno ime konstante (`PRODAJNI_AGENT`, ne "Agent prodaje") — vidi `apps/panel/src/app/(app)/korisnici/[id]/page.tsx`. Uvođenje čitljivog prikaznog imena (mapa `SYSTEM_ROLES → čitljiv naziv`, npr. `{ PRODAJNI_AGENT: 'Agent prodaje', SALES_MANAGER: 'Menadžer prodaje' }`) je nezavisna, mala UI izmena — ide u istom prolazu kad se M24 implementira, da HR ekran i `/korisnici` odmah govore istim jezikom.

#### Ograda — `SEF_POSLOVNICE` samo kao dodatna uloga (vlasnikov zahtev: "ovo jedino može da ide uz još jednu ulogu")

Sistem već podržava više uloga po korisniku (`/korisnici/[id]`, `RoleAssignment`) — ovo NIJE novi tehnički mehanizam, nego nova **validaciona ograda** nad postojećim: pri dodeli/uklanjanju uloge, ako je `SEF_POSLOVNICE` u konačnom skupu uloga korisnika:

- mora postojati **tačno jedna druga** uloga uz nju (ne nula, ne dve ili više),
- pokušaj da se doda kao jedina uloga, ili kao treća+, se odbija sa jasnom porukom ("Šef poslovnice mora ići uz tačno jednu drugu ulogu").

Sprovodi se u M1 `UsersService`/`RoleAssignment` akciji (backend, ne samo UI — isti princip kao svaka druga ograda u ovom projektu, zamka 13.5/13.6 iz `33-ZAMKE-I-OBAVEZNE-PROVERE.md`: ograda koja postoji samo u UI se zaobiđe direktnim pozivom API-ja).

### 2.2 `EmployeeRecord` — HR dosije, 1:1 sa M1 `User`

| Polje | Tip | Napomena |
| :--- | :--- | :--- |
| id | UUID (PK) | |
| user_id | UUID (FK → M1 User), unique | samo za `accountType = STAFF` naloge |
| employment_type | enum: `PUNO_RADNO_VREME`, `NEPUNO_RADNO_VREME`, `UGOVOR_O_DELU` | pravni značaj po Zakonu o radu RS |
| contract_basis | enum: `NEODREDJENO`, `ODREDJENO` | određuje da li je `contract_end_date` obavezno |
| hire_date | date | datum zasnivanja radnog odnosa |
| probation_end_date | date, nullable | kraj probnog rada, ako postoji |
| contract_end_date | date, nullable | obavezno ako `contract_basis = ODREDJENO` — ovo je polje koje AI HR agent prati (poglavlje 3) |
| termination_date | date, nullable | kraj radnog odnosa (offboarding) — popunjeno = zaposleni više nije aktivan u HR smislu, nezavisno od `User.status` (M1) koji kontroliše pristup sistemu |
| reports_to_user_id | UUID (FK → M1 User), nullable | neposredni rukovodilac — eksplicitno polje, odvojeno od organizacione uloge (npr. Agent prodaje u poslovnici Beograd izveštava se Šefu te poslovnice) |
| annual_leave_days_entitled | integer, nullable | dodeljeni dani godišnjeg odmora za tekuću godinu (RS minimum 20 radnih dana) |
| created_at / updated_at | timestamp | |
| updated_by_user_id | UUID, nullable | izmena ide u audit log (M1 §3.8), isti obrazac kao `AgencySettings` |

`branch_id` se **ne duplira ovde** — već postoji na `User.branch_id` (M1 §3.9b), M24 ga čita preko `user_id` relacije, princip #1 (jedan izvor istine).

### 2.3 `LeaveRecord` — odsustva (godišnji odmor, bolovanje, neplaćeno)

| Polje | Tip | Napomena |
| :--- | :--- | :--- |
| id | UUID (PK) | |
| employee_record_id | UUID (FK → EmployeeRecord) | |
| type | enum: `GODISNJI_ODMOR`, `BOLOVANJE`, `NEPLACENO_ODSUSTVO`, `OSTALO` | |
| start_date / end_date | date | |
| days_count | integer | radni dani u periodu — izračunato pri unosu (bez vikenda/praznika), ne ručno prebrojano |
| note | string, nullable | |
| recorded_by_user_id | UUID (FK → User) | ko je uneo zapis — prvi prolaz je ručna evidencija (HR/Vlasnik/Direktor), ne samouslužni zahtev zaposlenog (poglavlje 1) |
| created_at | timestamp | |

Preostali dani godišnjeg odmora = `annual_leave_days_entitled` − suma `days_count` gde `type = GODISNJI_ODMOR` za tekuću godinu — izračunato, ne čuvano polje (isti princip kao `current_outstanding_balance` u M7 §2 — jedan izvor istine, ne duplirano stanje).

### 2.4 `TrainingCertification` — obuke/sertifikati sa rokom (opciono, npr. za vodiče)

| Polje | Tip | Napomena |
| :--- | :--- | :--- |
| id | UUID (PK) | |
| employee_record_id | UUID (FK → EmployeeRecord) | |
| name | string | naziv obuke/sertifikata |
| issued_at | date, nullable | |
| expires_at | date, nullable | polje koje AI HR agent prati (poglavlje 3) — obavezna obuka bez roka ima `expires_at = null` i agent je ne prati |

---

## 3. Rokovi i AI HR agent

Master dokument poglavlje 7 (Model upravljanja AI agentima) definiše tri nivoa autonomije po AKCIJI — M24 domenski agent (kad M15 okvir postoji, uvodi se tek kad je M24 sam deterministički stabilan, isto pravilo kao svaki drugi domenski agent) ih primenjuje ovako:

| Akcija | Nivo | Napomena |
| :--- | :--- | :--- |
| Podsetnik pre isteka probnog rada (`probation_end_date`) | **Autonomno** | isti obrazac kao M18 signali/upozorenja — deterministički izračun datuma, nula rizika |
| Podsetnik pre isteka ugovora na određeno (`contract_end_date`) | **Autonomno** | zakonski rok, propuštanje ima pravne posledice — agent NIKAD ne sme da bude jedini kanal (dostavlja se kroz M18 notifikacioni kanal ljudima, ne zamenjuje ljudsku odluku) |
| Podsetnik pre isteka obuke/sertifikata | **Autonomno** | |
| Nacrt odgovora zaposlenom na opšte HR pitanje (radno vreme, politika odmora) | **Predloži pa čovek odobri** | isti obrazac kao M19 `SupplierDraftAgent`/M22 `EmailInboxAgent` — agent piše nacrt, čovek šalje |
| Predlog raspodele godišnjeg odmora (kad više ljudi traži isti period) | **Predloži pa čovek odobri** | |
| Izmena ugovora, otkaz, bilo šta sa pravnim dejstvom | **Nikad autonomno** | eksplicitno u Master dokumentu poglavlje 7, tačka 2 — "potpisivanje ugovora" je već navedeno kao primer koji AI agent nikad ne sme sam da izvrši |

---

## 4. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :--- | :--- |
| `M24/employee-record/VIEW` | Vlasnik, Direktor, HR — opšti HR podaci (pozicija, datumi, godišnji odmor) |
| `M24/employee-record/EDIT` | Vlasnik, Direktor, HR |
| `M24/leave-record/CREATE` | Vlasnik, Direktor, HR — prvi prolaz je ručna evidencija (poglavlje 1), ne samoposluživanje zaposlenog |

---

## 5. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/hr`

| Endpoint | Metod | Opis |
| :--- | :--- | :--- |
| `/hr/employees/:userId` | GET | HR dosije jednog zaposlenog — iza `M24/employee-record/VIEW` |
| `/hr/employees/:userId` | PATCH | iza `M24/employee-record/EDIT` |
| `/hr/employees/:userId/leave` | GET / POST | spisak odsustava / novi zapis, iza `LEAVE-RECORD/CREATE` za POST |
| `/hr/employees/:userId/leave-balance` | GET | preostali dani godišnjeg odmora (izračunato, poglavlje 2.3) |

---

## 6. Izlazni kriterijum

- [ ] Nove sistemske uloge (`SEF_POSLOVNICE`, `FINANSIJSKI_DIREKTOR`) postoje u M1 katalogu, dodeljive kroz postojeći `/korisnici/[id]` ekran bez izmene tog ekrana.
- [ ] Ograda "Šef poslovnice samo uz tačno jednu drugu ulogu" sprovedena na BACKEND-u (ne samo UI) — dokazano testom koji pokušava zaobilaženje direktnim pozivom API-ja (zamka 13.6).
- [ ] HR ekran u panelu (`/podesavanja/...` ili `/korisnici/[id]` prošireno — tačna lokacija odlučuje se pri implementaciji) prikazuje i uređuje sva polja iz poglavlja 2.2, samo za nosioca `M24/employee-record/EDIT`.
- [ ] Preostali dani godišnjeg odmora se tačno izračunavaju (dodeljeno − iskorišćeno), ne čuvaju kao ručno ažurirano polje.
- [ ] Podsetnik pre isteka ugovora na određeno/probnog roka stiže kroz M18 kanal najmanje X dana unapred (tačan broj dana potvrđuje vlasnik pri implementaciji).

---

## 7. Otvoreno za dalje

- **Formalni workflow odobravanja odsustva** (zaposleni sam podnosi zahtev, rukovodilac odobrava, kalendar tima) — prvi prolaz je ručna evidencija (poglavlje 1); ako se pokaže da to nije dovoljno, ovo postaje zaseban predlog.
- **GDPR/Zakon o zaštiti podataka — tačan rok čuvanja HR dosijea posle prestanka radnog odnosa** i procedura brisanja/anonimizacije — pravno pitanje, čeka potvrdu pravnika/knjigovođe pre nego što se bilo šta automatizuje (CLAUDE.md — ne izmišljati regulatorne detalje bez te potvrde). Do tada: `termination_date` samo označava neaktivnost, ništa se ne briše automatski.
- **Prikazni (čitljivi) naziv uloge u UI** umesto doslovnog imena konstante (poglavlje 2.1, napomena) — mala, nezavisna izmena, ide u istom prolazu kad M24 dobije kod.
- **Da li Šef poslovnice/Finansijski direktor treba da imaju svoju liniju u `ROLES_REQUIRING_MANDATORY_MFA`** (M1 §5) — verovatno DA (interne uloge), potvrditi pri implementaciji da nijedna nova uloga nije slučajno izostavljena iz obavezne 2FA liste.
- **Tačan broj dana unapred za podsetnik o isteku ugovora/probnog roka** (poglavlje 6 izlaznog kriterijuma) — razuman podrazumevan predlog je 30 dana za ugovor na određeno, 7 dana za probni rad, ali ovo je vlasnikova odluka, ne tehnička pretpostavka.
