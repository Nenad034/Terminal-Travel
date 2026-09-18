# API dokumentacija — M24 (Ljudski resursi)

**Namena:** ovaj dokument je za svakoga ko se povezuje sa Terminal-om spolja ili programski — interni tim preko panela, budući integratori (npr. spoljni HR/payroll sistem koji čita odsustva) — sa stvarnim primerima zahteva/odgovora za svaki endpoint, ne samo šemom. Interni oslonac za implementaciju (poslovna pravila, redosled provera, izlazni kriterijum) ostaje `docs/moduli/M24-ljudski-resursi/43-SPECIFIKACIJA-M24-LJUDSKI-RESURSI.md` — ovaj dokument ga ne zamenjuje.

**Prefiks:** `/api/v1/hr`
**Autentikacija:** `Authorization: Bearer <JWT>` na svakom pozivu (M1).

**Ko šta sme — dva mehanizma, ne jedan.** Deo ruta traži M1 dozvolu (`M24/employee-record/VIEW` ili `EDIT`, `M24/leave-record/CREATE`); deo radi po **vlasništvu** — zaposleni uvek vidi i traži **sopstveno**, neposredni rukovodilac (`reportsToUserId`) odlučuje o zahtevima **svojih** ljudi — bez ijedne dozvole. Rute po vlasništvu nemaju `@RequirePermission`; provera je u servisu i vraća `403` sa porukom koja imenuje dozvolu koja bi nedostajala.

**Validacija tela (od 18.9.2026):** svako telo prolazi kroz `class-validator` — nepoznato polje, pogrešan tip ili vrednost van raspona daju `400` sa spiskom poruka po polju (do tada su ove rute primale bilo šta — dok. 50 nalaz 3.1).

**Payroll-a nema, namerno** (spec §1): nema plata, nema ugovora o radu kao dokumenta — samo dosije, odsustva i rokovi.

---

## GET /hr/employees/:userId

HR dosije jednog zaposlenog. **`null` (HTTP 200) kad dosije još nije popunjen** — to nije greška, nego „prazan ekran je prazna baza" (dosije ne postoji za svakog korisnika, samo za onog kome ga je neko uneo).

Ko sme: sâm zaposleni (ownership) **ili** `M24/employee-record/VIEW`.

**Zahtev:**

```
GET /api/v1/hr/employees/46f6270a-4f49-404b-a20b-ef80d5bd4c01
```

**Odgovor `200` (popunjen):**

```json
{
  "id": "er-1",
  "userId": "46f6270a-4f49-404b-a20b-ef80d5bd4c01",
  "employmentType": "PUNO_RADNO_VREME",
  "contractBasis": "NEODREDJENO",
  "hireDate": "2024-03-01T00:00:00.000Z",
  "probationEndDate": "2024-06-01T00:00:00.000Z",
  "contractEndDate": null,
  "terminationDate": null,
  "reportsToUserId": "8f2c…",
  "createdAt": "2026-09-08T09:12:00.000Z",
  "updatedAt": "2026-09-08T09:12:00.000Z",
  "updatedByUserId": "1a7e…"
}
```

**Odgovor `200` (nema dosijea):** `null`

**Odgovor `403`** kad tuđi dosije gleda neko bez dozvole: `{"message":"Nema dozvolu M24/employee-record/VIEW","error":"Forbidden","statusCode":403}`

`employmentType`: `PUNO_RADNO_VREME` | `NEPUNO_RADNO_VREME` | `UGOVOR_O_DELU`. `contractBasis`: `NEODREDJENO` | `ODREDJENO`.

## PATCH /hr/employees/:userId

Upis ili izmena dosijea (upsert — isti poziv i prvi put i svaki sledeći). Dozvola: `M24/employee-record/EDIT`. Svaka izmena ostavlja revizijski trag (`employee-record.created` / `.updated`) sa stanjem pre i posle.

**Zahtev:**

```
PATCH /api/v1/hr/employees/46f6270a-4f49-404b-a20b-ef80d5bd4c01
Content-Type: application/json

{
  "employmentType": "PUNO_RADNO_VREME",
  "contractBasis": "ODREDJENO",
  "hireDate": "2026-10-01",
  "probationEndDate": "2026-12-31",
  "contractEndDate": "2027-09-30",
  "terminationDate": null,
  "reportsToUserId": "8f2c…"
}
```

`hireDate` obavezan (ISO datum); ostala tri datuma i `reportsToUserId` (UUID) opcioni, `null` briše vrednost.

**Odgovor `200`:** isti oblik kao `GET`.

**Odgovor `400`** (validacija):

```json
{
  "message": [
    "employmentType must be one of the following values: PUNO_RADNO_VREME, NEPUNO_RADNO_VREME, UGOVOR_O_DELU"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

## GET /hr/employees/:userId/leave

Sva odsustva jednog zaposlenog, najnovije prvo. Ko sme: isto kao `GET /hr/employees/:userId`.

**Odgovor `200`:**

```json
[
  {
    "id": "lv-7",
    "employeeRecordId": "er-1",
    "type": "GODISNJI_ODMOR",
    "status": "APPROVED",
    "startDate": "2026-10-01T00:00:00.000Z",
    "endDate": "2026-10-03T00:00:00.000Z",
    "daysCount": 3,
    "note": "porodično",
    "recordedByUserId": "46f6270a-…",
    "approvedByUserId": "8f2c…",
    "approvedAt": "2026-09-20T07:41:00.000Z",
    "rejectionReason": null,
    "createdAt": "2026-09-18T15:02:00.000Z"
  }
]
```

`type`: `GODISNJI_ODMOR` | `BOLOVANJE` | `NEPLACENO_ODSUSTVO` | `OSTALO`. `status`: `PENDING` | `APPROVED` | `REJECTED`.

## POST /hr/employees/:userId/leave

Zahtev za odsustvo. **Uvek nastaje kao `PENDING`** — ni HR unos nije automatski odobren (spec §3a). Ko sme: sâm zaposleni za sebe (bez dozvole) **ili** nosilac `M24/leave-record/CREATE` u ime bilo koga.

Preduslov: dosije mora postojati — inače `400` sa porukom „HR dosije za ovog zaposlenog još nije popunjen…".

**Zahtev:**

```
POST /api/v1/hr/employees/46f6270a-4f49-404b-a20b-ef80d5bd4c01/leave
Content-Type: application/json

{
  "type": "GODISNJI_ODMOR",
  "startDate": "2026-10-01",
  "endDate": "2026-10-03",
  "daysCount": 3,
  "note": "porodično"
}
```

`daysCount`: ceo broj **1–366** — danas se unosi ručno; spec §2.3 traži da se računa (radni dani bez praznika), to čeka odluku o spisku praznika (dok. 50 nalaz 3.6). `note` opcion, do 2000 znakova.

**Odgovor `201`:** zapis kao u listi iznad, `status: "PENDING"`.

**Odgovor `400`** (izmereno 18.9.2026):

```json
{
  "message": [
    "property nepoznatoPolje should not exist",
    "daysCount must not be less than 1",
    "daysCount must be an integer number"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

**Odgovor `403`** kad neko bez blanket dozvole traži za drugog: `"Nemate dozvolu da podnesete zahtev u ime drugog zaposlenog (M24/leave-record/CREATE)."`

## GET /hr/employees/:userId/leave-balance?year=2026

Stanje godišnjeg odmora — **izračunato, ne čuvano** (jedan izvor istine): `entitled` = dodeljeni dani za tu godinu + prenos iz prethodne ako mu rok nije prošao; `used` = zbir `daysCount` **odobrenih** (`APPROVED`) godišnjih odmora te godine; `remaining` = razlika. Bez `year` → tekuća godina. Ko sme: isto kao dosije.

**Odgovor `200`:**

```json
{ "entitled": 22, "used": 3, "remaining": 19 }
```

**Odgovor `200` kad za tu godinu nisu dodeljeni dani** (ili dosije ne postoji): `{ "entitled": null, "used": 0, "remaining": null }` — sistem **ne pogađa** broj iz prethodne godine.

## GET /hr/employees/:userId/leave-entitlements

Dodeljeni dani po godini (spec §2.2a — jedan red po godini, umesto jednog broja na dosijeu). Ko sme: isto kao dosije.

**Odgovor `200`:**

```json
[
  {
    "id": "le-3",
    "employeeRecordId": "er-1",
    "year": 2026,
    "daysEntitled": 20,
    "carriedOverDays": 2,
    "carriedOverExpiresAt": "2026-06-30T00:00:00.000Z",
    "createdAt": "2026-01-05T08:00:00.000Z",
    "updatedAt": "2026-01-05T08:00:00.000Z",
    "updatedByUserId": "1a7e…"
  }
]
```

## PUT /hr/employees/:userId/leave-entitlements/:year

Upis/izmena dodeljenih dana za jednu godinu (upsert). Dozvola: `M24/employee-record/EDIT`. Prenos (`carriedOverDays`) je **ručno potvrđena** vrednost — sistem ga ne obračunava sam (Zakon o radu RS: rok 30.6. naredne godine, spec §2.2a).

**Zahtev:**

```
PUT /api/v1/hr/employees/46f6270a-…/leave-entitlements/2026
Content-Type: application/json

{ "daysEntitled": 20, "carriedOverDays": 2, "carriedOverExpiresAt": "2026-06-30" }
```

`daysEntitled` i `carriedOverDays`: ceo broj 0–365. **Odgovor `200`:** red kao u listi iznad.

## PATCH /hr/leave/:leaveId/approve

Odobrenje zahteva. Ko sme: **neposredni rukovodilac** tog zaposlenog (`reportsToUserId` na dosijeu) bez dozvole, **ili** nosilac `M24/leave-record/CREATE`. Samo `PENDING` zapis; već obrađen daje `400` „Zahtev je već obrađen". Zapis sa `daysCount ≤ 0` (nastao pre validacije) se **ne može odobriti** — `400`.

**Zahtev:** `PATCH /api/v1/hr/leave/lv-7/approve` (bez tela)

**Odgovor `200`:** zapis sa `status: "APPROVED"`, `approvedByUserId`, `approvedAt`.

**Odgovor `403`:** `"Nemate ovlašćenje da odlučite o ovom zahtevu — niste neposredni rukovodilac, niti nosilac M24/leave-record/CREATE."`

## PATCH /hr/leave/:leaveId/reject

Odbijanje — **razlog je obavezan**. Isti krug ovlašćenih kao za odobrenje.

**Zahtev:**

```
PATCH /api/v1/hr/leave/lv-7/reject
Content-Type: application/json

{ "reason": "Preklapa se sa sezonom, dogovoriti drugi termin." }
```

**Odgovor `200`:** zapis sa `status: "REJECTED"`, `rejectionReason`. Bez razloga → `400` „Razlog odbijanja je obavezan."

## GET /hr/leave/calendar?from=2026-10-01&to=2026-10-31&branchId=…

Timski kalendar odsustava (spec §3b) — ko je kad odsutan, po poslovnici ako se zada `branchId`. Ko sme: svaki prijavljeni korisnik, ali **vidi različito**:

- `approved` — **svi** odobreni u rasponu, za sve (da tim zna ko nije tu);
- `pending` — nosilac `M24/leave-record/CREATE` vidi sve; ostali samo sopstvene zahteve, zahteve ljudi kojima su rukovodilac, i one koje su sami uneli;
- `note` — vidljiva samo sebi, rukovodiocu i nosiocu blanket dozvole; ostalima `null`.

**Odgovor `200`:**

```json
{
  "approved": [
    {
      "id": "lv-7",
      "type": "GODISNJI_ODMOR",
      "status": "APPROVED",
      "startDate": "2026-10-01T00:00:00.000Z",
      "endDate": "2026-10-03T00:00:00.000Z",
      "daysCount": 3,
      "note": null,
      "employee": { "id": "46f6270a-…", "fullName": "Mila Petrović" }
    }
  ],
  "pending": []
}
```

---

## Revizijski trag

Svaka promena piše `AuditLogEntry` (M1 §3.8): `employee-record.created/updated`, `leave-entitlement.created/updated`, `leave-record.requested`, `leave-record.approved`, `leave-record.rejected` — sa akterom, stanjem pre/posle i `context.employeeRecordId`. Čita se preko `GET /iam/audit-log` (M1).

## Šta još nije u API-ju (namerno)

- Rokovi obuka/sertifikata (`TrainingCertification`) — model postoji, endpoint još ne (spec §2.4, čeka AI HR agenta iz backloga).
- Automatski prenos neiskorišćenih dana 30.6. — svesno odloženo (backlog M24).
- Računanje `daysCount` iz datuma (radni dani bez praznika) — čeka spisak praznika (dok. 50 nalaz 3.6).
