# Specifikacija modula M4 — Integracije spoljnih API konekcija

**Odnosi se na:** `00-MASTER-ARHITEKTURA.md`, poglavlje 4 (M4) i poglavlje 8 (Faza 1)
**Nivo:** Nivo 2 — detaljna specifikacija, dovoljna da AI agent direktno programira po njoj
**Status:** Nacrt za usvajanje (pisano od nule — raniji "Travelgate predlog" pomenut u Master dokumentu nije pronađen)
**Verzija:** 1.0
**Zavisi od:** M1 (Core / Identitet i pristup), M2 (Katalog proizvoda)

---

## 1. Svrha i obim modula

M4 je sloj adaptera koji prevodi formate spoljnih dobavljača proizvoda (Travelgate za hotele; kasnije GDS/avio, transferi, aktivnosti) u jedan interni, provajder-nezavisan oblik koji koriste M2 (katalog) i M5 (rezervacije). Ni M2 ni M5 nikad ne znaju da li podatak dolazi sa Travelgate-a ili nekog budućeg provajdera — vide samo interni oblik koji M4 garantuje. Ovo je direktna primena principa #3 iz poglavlja 3 Master dokumenta.

Van obima: SEF, ESIR, eTurista, YUTA — iako su i to "spoljne integracije" u širem arhitektonskom smislu (poglavlje 5), te konkretne integracije se specificiraju unutar M10 i M11 kad ti moduli dođu na red, ne ovde. M4 (kao modul iz poglavlja 4, ne kao opšti sloj iz dijagrama u poglavlju 5) obuhvata isključivo dobavljače **turističkog proizvoda/inventara**.

---

## 2. Adapterski interfejs — ugovor koji svaki provajder mora ispuniti

Svaki spoljni provajder se povezuje kroz jedan adapter koji implementira isti interfejs, tako da dodavanje novog provajdera (npr. GDS za avio karte) nikad ne zahteva izmenu M2 ili M5:

```
interface ProviderAdapter {
  providerCode: string;                 // npr. "travelgate"
  category: "HOTEL" | "FLIGHT" | "TRANSFER" | "ACTIVITY" | "INSURANCE";

  search(params: SearchParams): Promise<NormalizedSearchResult[]>;
  getStaticContent(externalId: string): Promise<NormalizedContent>;
  checkAvailabilityAndPrice(externalId: string, stay: StayParams): Promise<AvailabilityQuote>;
  confirmBooking(externalId: string, booking: BookingRequest): Promise<BookingConfirmation>;
  cancelBooking(providerBookingReference: string): Promise<CancellationResult>;
}
```

### 2.1 Normalizovani oblici (interni, provajder-nezavisni)

- **`NormalizedContent`** — isti oblik kao `Product` + `ProductTranslation` iz M2 (naziv, opis, slike, lokacija, atributi po tipu). M4 vraća ovaj oblik direktno M2-u za lenjo keširanje (vidi M2 spec, poglavlje 3.2) — nema prevođenja "na pola puta".
- **`AvailabilityQuote`** — `{ externalId, priceAmount, currency, availableUnits, cancellationPolicy, quoteExpiresAt }`. Nikad se ne čuva trajno kao cena proizvoda (u skladu sa M2 spec, poglavlje 4) — koristi se odmah ili se odbacuje.
- **`BookingConfirmation`** — `{ providerBookingReference, status: "CONFIRMED" | "PENDING_SUPPLIER_CONFIRMATION" | "FAILED", confirmedPrice, confirmedAt }`. Status `PENDING_SUPPLIER_CONFIRMATION` postoji jer neki spoljni hoteli (baš kao `ON_REQUEST` alotman u M3) ne potvrđuju rezervaciju odmah — M5 tretira ovo isto kao "na čekanju" status, bez obzira da li dolazi iz M3 ili M4.

---

## 3. Model podataka

### 3.1 `ProviderConfig`
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| provider_code | string, unique | npr. `travelgate` |
| display_name | string | |
| category | enum (vidi 2.) | |
| auth_config_encrypted | string | API ključevi/endpoint, enkriptovano u mirovanju; stvarni sekret nikad u kodu ili plain konfiguraciji (poglavlje 9) |
| status | enum: `ACTIVE`, `INACTIVE` | isključivanje provajdera bez brisanja konfiguracije |
| timeout_search_ms / timeout_booking_ms | integer | po provajderu — pretraga sme kraće da čeka od potvrde rezervacije |
| created_at / updated_at | timestamp | |

### 3.2 `ProviderCallLog` — operativni log (odvojeno od M1 audit loga)
| Polje | Tip | Napomena |
| :---- | :---- | :---- |
| id | UUID (PK) | |
| provider_code | string | |
| operation | enum: `SEARCH`, `CONTENT`, `AVAILABILITY`, `BOOK`, `CANCEL` | |
| request_summary | JSONB | bez ličnih podataka gosta gde god je moguće (poglavlje 7, tačka 5 Master dokumenta) |
| response_status | string | HTTP/GraphQL status ili "TIMEOUT" |
| latency_ms | integer | |
| error_message | text, nullable | |
| timestamp | timestamp | |

Svrha: dijagnostika integracije (da li Travelgate usporava, da li određeni pozivi stalno padaju) — tehnički log, kratkog veka (npr. 90 dana rotacija), za razliku od `AuditLogEntry` u M1 koji je trajan i pravno relevantan. **Svaki uspešan/neuspešan `BOOK`/`CANCEL` poziv dodatno upisuje zapis i u M1 `AuditLogEntry`** (`actor_type = SYSTEM`) jer to ima stvarnu finansijsku težinu — `ProviderCallLog` sam po sebi nije dovoljan za tu vrstu radnje.

---

## 4. Otpornost na greške (M4 mora da pretpostavi da spoljni provajderi ponekad ne rade)

- **Timeout po operaciji** — pretraga: kratak (npr. 8s), potvrda rezervacije: duži (npr. 15s), konfigurabilno po provajderu (`ProviderConfig`).
- **Degradacija bez pada:** ako jedan provajder ne odgovori na `search`, M5 dobija rezultate od ostalih dostupnih izvora (M3 ugovoreni proizvodi + drugi API provajderi), uz grešku samo za taj jedan zabeleženu u `ProviderCallLog` — pretraga gosta se nikad ne prekida zbog jednog neispravnog provajdera.
- **Idempotentnost za `confirmBooking`:** ovo je jedina operacija gde slepo ponavljanje posle timeout-a može izazvati duplu rezervaciju (mrežni timeout ne znači da poziv nije uspeo na strani provajdera). Svaki poziv nosi jedinstveni `idempotency_key` (generisan u M5 po pokušaju rezervacije); pre bilo kog ponovnog pokušaja, M4 prvo proverava `ProviderCallLog` da li je taj `idempotency_key` već poslat i sa kojim ishodom, umesto da automatski ponovi poziv. Ovo je direktna primena principa #4 (determinizam pre autonomije) — greška ovde je novac, ne kozmetika.
- **Retry dozvoljen** samo za operacije koje se sigurno mogu ponoviti bez posledice (`search`, `getStaticContent`, `checkAvailabilityAndPrice`) — do 2 pokušaja sa kratkim razmakom.

---

## 5. Travelgate adapter — implementaciona napomena

Travelgate izlaže GraphQL API (poglavlje 6 Master dokumenta). Travelgate adapter je jedino mesto u celom sistemu koje govori GraphQL — unutar `search`/`getStaticContent`/itd. implementacije, adapter šalje GraphQL upite i mapira odgovor u `NormalizedSearchResult`/`NormalizedContent`/`AvailabilityQuote`/`BookingConfirmation`. Ni M2 ni M5 ni bilo koji drugi modul ne vidi GraphQL — to je granica adaptera.

---

## 6. Dozvole (registruju se u M1 katalog dozvola)

| Dozvola | Podrazumevana dodela po ulozi |
| :---- | :---- |
| `M4/provider-config/VIEW` | Vlasnik, Direktor |
| `M4/provider-config/CREATE`, `EDIT` | Vlasnik, Direktor |
| `M4/provider-call-log/VIEW` | Vlasnik, Direktor |

Napomena: M4 je pretežno mašina-mašini sloj (pozivaju ga M2/M5 interno) — ovlašćenja iznad su samo za administrativni uvid/podešavanje provajdera, ne za svakodnevnu upotrebu.

---

## 7. API ugovor (REST, OpenAPI) — ključni endpoint-i

Prefiks: `/api/v1/integrations`

**Administrativni (za interni panel):**
| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/providers` | GET / POST | lista / dodavanje konfiguracije provajdera |
| `/providers/:code` | GET / PATCH | uključivanje/isključivanje, izmena kredencijala |
| `/provider-call-logs` | GET | filtrirano po provajderu/operaciji/datumu/statusu, za dijagnostiku |

**Interni (poziva ih isključivo M2/M5, nisu izloženi kanalima poput sajta ili B2B portala):**
| Endpoint | Metod | Opis |
| :---- | :---- | :---- |
| `/internal/providers/:code/search` | POST | vraća `NormalizedSearchResult[]` |
| `/internal/providers/:code/content/:externalId` | GET | vraća `NormalizedContent` |
| `/internal/providers/:code/availability` | POST | vraća `AvailabilityQuote` |
| `/internal/providers/:code/bookings` | POST | `confirmBooking`, zahteva `idempotency_key` |
| `/internal/providers/:code/bookings/:ref/cancel` | POST | `cancelBooking` |

---

## 8. Izlazni kriterijum (M4 deo Faze 1)

- [ ] Travelgate adapter implementiran, ispunjava `ProviderAdapter` interfejs u potpunosti.
- [ ] Rezultati pretrage se ispravno normalizuju i M2 lenjo keširanje radi kraj-do-kraja (vidi M2 spec).
- [ ] `AvailabilityQuote` poštuje `quoteExpiresAt` — M5 odbija potvrdu rezervacije sa isteklom ponudom i traži novu proveru.
- [ ] Test simuliranog timeout-a pri `confirmBooking` sa ponovljenim pokušajem ne pravi duplu rezervaciju (provera preko `idempotency_key`).
- [ ] Simulirani pad Travelgate-a ne ruši pretragu — ostali izvori i dalje vraćaju rezultate, greška je zabeležena.
- [ ] Kredencijali provajdera enkriptovani u bazi, nikad u čistom tekstu u logovima (`ProviderCallLog.request_summary` redaktovan).

---

## 9. Otvoreno za dalje

- Konkretni adapteri za buduće kategorije (GDS/avio, transferi, aktivnosti) implementiraju se kad ti proizvodi dođu na red — isti `ProviderAdapter` interfejs, bez redizajna M4.
- Tačni limiti brzine poziva (rate limiting) po provajderu definišu se kad se zna stvarni Travelgate ugovor i njegova ograničenja — za sada M4 samo predviđa mesto (`ProviderConfig`) gde se ti limiti mogu podesiti.
- Ako se pronađe raniji "Travelgate predlog" pomenut u Master dokumentu, ovaj dokument treba uporediti sa njim i uskladiti razlike, ne pisati dva paralelna izvora istine za M4.
