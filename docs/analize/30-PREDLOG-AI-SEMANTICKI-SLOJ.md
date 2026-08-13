# Predlog — AI Semantički sloj nad podacima (dostavio vlasnik, 13.8.2026)

**Status:** Sirov predlog, dostavljen u razgovoru — **nije prošao `tt-architecture-core` proveru niti potvrdu vlasnika o otvorenim pitanjima**. Čuva se ovde u celini da se ne izgubi, do trenutka kad se vlasnik vrati na temu.

Vlasnik je eksplicitno rekao (13.8.2026): "hajde da ne radimo sada na ovome zapisite da uradimo pa cemo kasnije" — odloženo, ne odbijeno.

---

## Otvorena pitanja pre nego što ovo dobije spec/kod (identifikovano pri prvom čitanju)

1. **"M-24 Inventory Aggregation Layer"** — dokument ga pominje kao zavisnost, ali taj modul ne postoji u Terminal Travel mapi modula (`docs/00-MASTER-ARHITEKTURA.md` poglavlje 4, trenutno M1–M23). Pominjani provajderi (TravelgateX/Travelport/Duffel) se ne poklapaju sa M4 (Travelgate/Solvex-Master-Interlook). Treba razjasniti sa vlasnikom: nov modul koji tek treba specificirati, ili pogrešan/zastareo naziv za M4.
2. **Fizička lokacija lokalnog LLM hardvera** (dokument pominje RTX 4090/vLLM/Tailscale) — master dokument poglavlje 9 zahteva EU fizičku lokaciju za lične/zdravstvene podatke. Nije potvrđeno da li je ovaj hardver u EU.
3. **Usklađivanje sa M15** — M15 (već specificiran, `docs/moduli/M15-ai-orkestracija/`) definiše model "Glavni agent + jedan domenski agent po modulu", tri nivoa autonomije. Predlog uvodi sopstvenu podelu ("offers/finance/B2B/content" agenti) koja se mora ili preslikati na postojeće M15 domenske agente (verovatnije: semantički sloj je backend za upite koji ti agenti koriste), ili se M15 mora svesno revidirati — vlasnik treba da odluči.
4. **Nova tehnologija van poglavlja 6** — Cube.dev, pgvector, LiteLLM nisu deo usvojenog tehničkog steka (`docs/00-MASTER-ARHITEKTURA.md` poglavlje 6). Zahteva izričitu potvrdu vlasnika pre uvođenja, po CLAUDE.md tvrdom pravilu.
5. **Numeracija modula** — dokument koristi "M-25"/"M-24" (sa crticom); ostatak projekta koristi "M25"/"M24" bez crtice. Sitno, ali treba uskladiti kad/ako ovo dobije zvaničan spec.

---

## Originalni tekst predloga (dostavljen bez izmena)

# M-25: AI Semantic Layer — Tehnička Specifikacija

**Status:** Draft za implementaciju
**Vlasnik:** Nenad / Terminal Travel Agency (TTA)
**Zavisnosti:** M-24 Inventory Aggregation Layer, pgvector infrastruktura, LiteLLM routing
**Namena dokumenta:** Ulazna specifikacija za AI coding agenta (Claude Code / Cowork)

---

## 1. Cilj modula

Trenutno svaki agent (offers, finance, B2B, content) koji treba da "pita" bazu podataka prirodnim jezikom mora ili:
- da ima hardkodovane SQL upite (nefleksibilno, teško za održavanje), ili
- da LLM sam generiše SQL direktno nad šemom (rizično — nagađanje JOIN-ova, halucinacije, curenje podataka van dozvoljenog opsega).

**M-25 uvodi semantički sloj** — eksplicitan, verzionisan katalog poslovnih metrika i relacija — kroz koji LLM generiše upite. Model ne vidi sirovu šemu; vidi samo imenovane, testirane definicije (npr. `marza_po_rezervaciji`, `popunjenost_alotmana`, `provizija_sub_agenta`).

**Analogija:** Google je uradio isto integrišući Looker semantički sloj u Gemini Enterprise (avgust 2026) — SQL se generiše iz poslovne logike s kontrolom verzija, ne iz nagađanja modela, što po njihovim navodima smanjuje greške u podacima za do 2/3.

---

## 2. Zašto je ovo kritično za TTA (ne samo "nice to have")

- **Data sovereignty pravilo** (već definisano u arhitekturi): klijentski lični podaci i interne cene NE SMEJU ići na eksterne modele. Semantički sloj je mesto gde se ovo pravilo *tehnički sprovodi*, ne samo dogovara — permisije žive u sloju, ne u promptu.
- **Row/column-level security** po ulozi (komercijala vidi svoje ponude, finansije vide sve, sub-agent vidi samo svoj B2B promet) postaje deo definicije metrike, a ne ad-hoc WHERE klauzule koje neko može zaboraviti.
- Jedan izvor istine za interne dashboard-e I za AI agente — margina se računa isto svuda.

---

## 3. Predloženi stack

| Komponenta | Izbor | Razlog |
|---|---|---|
| Semantic layer engine | **Cube.dev** (self-hosted, open-source) | Docker-friendly, uklapa se u postojeći hybrid stack (RTX 4090 / vLLM / Tailscale), ima native REST + SQL API, YAML modeli |
| Baza | PostgreSQL (postojeća) | Bez migracije |
| LLM routing | LiteLLM (postojeći) | NL→query ostaje pod istim hard rule-om (lokalni model za osetljive upite) |
| Auth/permisije | Cube.dev Security Context + postojeći JWT sloj | Row/column-level po `role` i `sub_agent_id` |
| Vector kontekst (opciono, faza 2) | pgvector | Za semantic search nad definicijama metrika kad katalog preraste ~50 metrika |

**Alternativa razmotrena i odbačena:** dbt Semantic Layer — zahteva dbt Cloud za puni API pristup ili kompleksniji self-hosted setup (MetricFlow + custom server); Cube.dev ima jednostavniji self-hosted put do produkcije.

---

## 4. Arhitektura toka podataka

```
[Korisnik prirodnim jezikom]
        │
        ▼
[Agent (offers/finance/B2B/content)]
        │
        ▼
[LiteLLM router] ── hard rule: PII/cene → lokalni model
        │
        ▼
[NL→Semantic Query prevodilac]
   (LLM vidi SAMO katalog metrika, ne sirovu šemu)
        │
        ▼
[Cube.dev semantic layer]
   - primenjuje permisije (role, sub_agent_id)
   - generiše SQL iz verzionisane definicije
        │
        ▼
[PostgreSQL]
        │
        ▼
[Rezultat → agent → korisnik]
```

Ključna razlika u odnosu na trenutno stanje: LLM nikad ne piše SQL direktno. LLM bira/parametrizuje postojeću, testiranu metriku.

---

## 5. Struktura semantičkih modela (primer)

Direktorijum: `/semantic-layer/models/`

```yaml
# rezervacije.yml
cubes:
  - name: rezervacije
    sql_table: bookings
    joins:
      - name: sub_agenti
        sql: "{CUBE}.sub_agent_id = {sub_agenti}.id"
        relationship: many_to_one

    measures:
      - name: marza_ukupno
        sql: prodajna_cena - nabavna_cena
        type: sum
        description: "Ukupna marža u periodu"

      - name: broj_rezervacija
        type: count

    dimensions:
      - name: status
        sql: status
        type: string
      - name: sub_agent_id
        sql: sub_agent_id
        type: string
        shown: false  # koristi se za permisije, ne prikazuje se direktno

    # Row-level security
    security_context: |
      {% if security_context.role == 'sub_agent' %}
        sub_agent_id = '{{ security_context.sub_agent_id }}'
      {% endif %}
```

Svaki novi modul (finance, B2B, content) dobija svoj `.yml` fajl. Promene idu kroz Git — puna kontrola verzija, kao i ostatak platforme.

---

## 6. Integracija sa postojećim agentima

| Agent | Upotreba semantičkog sloja |
|---|---|
| **Offers/komercijala** | "Koja je prosečna marža na letovanjima u Grčkoj za avgust?" → poziva `rezervacije.marza_ukupno` filtrirano po destinaciji/mesecu |
| **Finance/reconciliation** | Upiti za usklađivanje banaka, provizije — koristi iste `measures` koje koristi i finance dashboard |
| **B2B sub-agent mreža** | Sub-agent pita "koliki mi je promet ovog meseca" — `security_context` automatski ograničava na njegov `sub_agent_id`, bez posebne logike u agentu |
| **Content/marketing** | Read-only pristup agregiranim, anonimizovanim metrikama (bez PII) |
| **Legal compliance** | Nema pristup — ovaj modul nije relevantan za pravni agent |

---

## 7. API kontrat (za AI agenta koji implementira)

### Endpoint 1: Lista dostupnih metrika (za dati role)
```
GET /api/semantic/meta
Header: Authorization: Bearer <jwt>
→ vraća listu measures/dimensions dostupnih toj ulozi
```

### Endpoint 2: Izvršenje upita
```
POST /api/semantic/query
Body: {
  "measures": ["rezervacije.marza_ukupno"],
  "dimensions": ["rezervacije.status"],
  "filters": [{"member": "rezervacije.datum", "operator": "inDateRange", "values": ["2026-07-01","2026-07-31"]}]
}
→ Cube.dev primenjuje security_context iz JWT-a → vraća rezultat
```

### Endpoint 3: NL prevodilac (agent-facing)
```
POST /api/semantic/nl-query
Body: { "pitanje": "Koja mi je marža za jul?", "role": "sub_agent", "sub_agent_id": "SA-042" }
→ LiteLLM (lokalni model ako sadrži cene/PII) mapira pitanje na semantic query iz tačke 2
→ NIKAD ne generiše sirov SQL
```

---

## 8. Sigurnosni zahtevi (non-negotiable)

1. LLM komponenta NIKADA ne dobija pristup sirovoj šemi baze — samo katalogu metrika.
2. Svaki upit prolazi kroz `security_context` proveru pre izvršenja, bez izuzetka.
3. Upiti koji sadrže klijentske PII podatke ili nabavne cene rutiraju se isključivo kroz lokalni model (postojeći LiteLLM hard rule) — ovo se mora eksplicitno testirati, ne pretpostaviti.
4. Sve izmene `.yml` modela idu kroz code review (Git PR), ne kroz runtime izmene.
5. Audit log svakog izvršenog upita: ko, koja metrika, koji filter, kada.

---

## 9. Predlog sprint plana

| Sprint | Obim |
|---|---|
| 1 | Cube.dev setup (Docker), povezivanje na PostgreSQL, prvi model (`rezervacije`) sa 3-4 osnovne metrike |
| 2 | Row-level security po `role`/`sub_agent_id`, testiranje sa B2B agentom |
| 3 | NL→query prevodilac kroz LiteLLM, integracija sa offers/finance agentima |
| 4 | Proširenje kataloga (marketing, content metrike), audit log, dashboard nad istim slojem |

---

## 10. Otvorena pitanja za Nenada (pre implementacije)

- Da li M-25 ide kao potpuno nov modul ili se prvi model (`rezervacije`) direktno nadovezuje na postojeću M-24 šemu (TravelgateX/Travelport/Duffel agregirani podaci)?
- Da li dashboard (interni back-office) treba odmah da čita iz Cube.dev API-ja, ili ostaje na direktnim upitima dok se semantic layer ne stabilizuje?
- Prioritet: da li je hitniji use case finance (usklađivanje/provizije) ili B2B sub-agent samoposluga (promet uvid)?

---

*Ovaj dokument je ulazna tačka za AI coding agenta. Agent treba da pročita M-24 spec i postojeću PostgreSQL šemu pre generisanja `.yml` modela, i da poštuje hard rule o lokalnom modelu za osetljive podatke definisan u glavnoj arhitekturi platforme.*
