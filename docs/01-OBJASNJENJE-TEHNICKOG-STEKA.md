# Objašnjenje tehničkog steka — za nekoga ko ne programira

**Odnosi se na:** poglavlje 6 dokumenta `00-MASTER-ARHITEKTURA.md`
**Namena:** referentni dokument da se vlasnik projekta (Nenad Tomić) po potrebi vrati i podseti šta koji alat radi, bez potrebe da se to ponovo objašnjava u razgovoru.

---

## Kako sve ovo izgleda zajedno (kratko)

Next.js prikazuje stranicu → poziva NestJS module preko REST API-ja → NestJS proverava prava preko IAM-a i primenjuje poslovna pravila → Prisma čita/piše podatke u PostgreSQL → sve se hostuje na EU serverima, gradi iz jednog koda (Turborepo), i ništa ne ide u produkciju dok ne prođe testove.

---

## Pojedinačni alati

### TypeScript — jezik u kom se piše sav kod
Zamisli ga kao obično programiranje, ali sa ugrađenom proverom grešaka: ako neko (ili AI agent) pokuša da, recimo, cenu rezervacije tretira kao tekst umesto kao broj, TypeScript to prijavi *pre* nego što kod uopšte proradi — ne kad gost već pokušava da plati. Bitno je jer najveći deo koda piše AI, ne vlasnik projekta — ova provera je mreža koja hvata AI-jeve greške rano.

### NestJS — okvir za poslovnu logiku (backend)
Tu živi sva poslovna logika: pravila oko rezervacija, cena, korisničkih prava. Zamisli ga kao unapred definisanu "fioku" strukturu — svaki modul (M1, M2, M5...) ima svoje tačno mesto, svoju fasciklu, svoj obrazac. Bez ovoga bi svaki AI agent mogao da piše kod na svoj način, pa bi posle 16 modula sistem bio haos. NestJS nameće disciplinu.

### PostgreSQL — baza podataka
Mesto gde se *stvarno* čuvaju svi podaci: svaka rezervacija, svaki gost, svaka faktura. "Trezor" sistema. Izabrana je jer strogo čuva odnose između podataka (npr. ne dozvoljava da rezervacija postoji bez gosta, ili da faktura postoji bez rezervacije) — presudno kad se radi o novcu i zakonskim obavezama.

### Prisma — prevodilac između koda i baze (ORM)
Umesto da AI agent ručno piše sirove upite ka bazi (gde je lako pogrešiti kolonu ili tabelu), Prisma to radi automatski na osnovu jasno napisane šeme podataka. Zamisli je kao asistenta koji čita "recept" (šemu) i sam sastavlja tačan upit — smanjuje broj mesta gde AI može da napravi grešku.

**Odluka (jul 2026.):** potvrđena nasuprot alternativi Drizzle. Drizzle je tehnički bliži sirovom SQL-u, ali Prisma je duže na tržištu i bolje zastupljena u podacima na kojima su AI modeli trenirani — manji rizik od suptilnih grešaka u AI-generisanom kodu, što je presudno jer vlasnik projekta sam ne piše/proverava kod.

### REST + OpenAPI — "jezik" komunikacije između delova sistema
Način na koji moduli međusobno razgovaraju, i kojim sajt/aplikacija razgovaraju sa modulima. OpenAPI je pisani ugovor ("ovaj poziv traži ove podatke, vraća ove podatke") koji se može mašinski proveriti — i AI agent i automatski testovi mogu proveriti da li je neko ispoštovao taj ugovor, bez ručne provere.

### Event Bus — obaveštenja između modula
Sistem obaveštenja za stvari koje se dešavaju asinhrono, van glavnog toka. Primer: kad gost otkaže rezervaciju, M5 (Rezervacije) ne treba direktno da zove M12 (Marketing) da prestane da mu šalje ponude — M5 samo "objavi" događaj "rezervacija otkazana", a M12 (i bilo koji drugi zainteresovan modul) to sam pokupi kad mu odgovara. Ovo drži module nezavisnim jedne od drugih.

### pgvector + OpenAI embeddings — pretraga po značenju, ne po tačnim rečima (M21/M23)
Kad tim ili subagent postavi pitanje AI asistentu (Centar za pomoć ili Znanje o destinacijama), do sad se odgovor tražio preko preklapanja tačnih reči — ako je pitanje "kako da resetujem lozinku" a članak kaže "promena akreditiva naloga", sistem ih ne bi povezao iako znače isto. `pgvector` je dodatak postojećoj bazi podataka (ne nova baza) koji ume da pretražuje po **značenju** teksta, ne po tačnim rečima — kao da razume šta pitanje znači, ne samo šta piše. Da bi to radio, svaki tekst (pitanje i članak) se prvo pretvori u niz brojeva ("otisak značenja") preko OpenAI servisa, pa se ti otisci porede. Bez OpenAI ključa sistem i dalje radi kao pre (staro poređenje reči) — ovo je nadogradnja, ne zamena koja bi nešto pokvarila ako izostane.

### Next.js (React) — ono što se vidi na ekranu (frontend)
Okvir za sve što gost, tim ili subagent *vidi na ekranu*: javni sajt, interni radni panel, B2B portal. Uzima podatke iz modula (preko REST API-ja) i prikazuje ih kao veb stranicu. Isti okvir se koristi za sva tri prikaza da se ne bi gradilo troje odvojenih sistema.

**Odluka (jul 2026.):** hostuje se u standardnom self-hosted Node.js režimu na EU cloud infrastrukturi, bez oslanjanja na Vercel-ekskluzivne funkcije (Edge ISR, Partial Prerendering). Razlog nije samo izbegavanje vezanosti za jednog provajdera (vendor lock-in) — Vercel je američka kompanija podložna US CLOUD Act-u i (od početka 2026.) nije na listi EU-U.S. Data Privacy Framework, što je u napetosti sa zahtevom iz poglavlja 9 Master dokumenta za fizičku lokaciju ličnih/zdravstvenih podataka u EU. Prelazak na Vercel ostaje tehnički moguć kasnije (Vercel je napravljen da bez muke hostuje standardan Next.js kod), ali bi zahtevao prethodnu pravnu proveru usklađenosti, ne samo tehničku odluku.

### IAM / RBAC (Keycloak ili Auth.js) — čuvar na vratima
Proverava ko si (login) i šta smeš da vidiš/radiš (npr. subagent vidi samo svoje rezervacije, marketing agent ne vidi finansije). Jedan centralni sistem za ovo, da se ne bi svaki modul sam snalazio oko prijave i prava.

### EU cloud hosting (Hetzner / AWS / Azure EU) + IaC
Gde fizički "žive" serveri i baza — u EU, zbog zakona o zaštiti ličnih podataka (pasoši, zdravstveni podaci za osiguranje). IaC (infrastructure as code) znači da se cela serverska postavka opisuje kodom, pa je AI agent može pouzdano ponoviti ili izmeniti bez ručnih koraka koji se lako zaborave.

### Turborepo / Nx — organizacija koda (monorepo alat)
Svi moduli žive u jednom "skladištu" (repozitorijumu) koda, dele zajedničke definicije (npr. šta tačno znači "Rezervacija"), ali se i dalje mogu graditi i testirati odvojeno. Bez ovoga bi definicija istog pojma mogla da se piše na dva različita mesta i vremenom prestane da se poklapa.

### Testiranje i CI
Automatski testovi koji se pokreću pre nego što se bilo koji kod pusti u produkciju, i sistem koji to nameće (ne pušta kod dok testovi ne prođu). Ključna "ograda" s obzirom da AI piše veliki deo koda — test je jedini objektivan dokaz da taj kod stvarno radi ono što treba.

---

## Razmatrane alternative i zašto nisu izabrane

| Alat iz predloga | Alternativa | Zašto alternativa nije izabrana (jul 2026.) |
| :---- | :---- | :---- |
| NestJS | Hono, Fastify | Brže i manje šablonski okviri, ali gube baš onu strukturu/disciplinu koja pomaže AI agentu da prati konvencije bez nagađanja. |
| Prisma | Drizzle | Drizzle je tehnički bliži SQL-u i sazreo je (PlanetScale zaposlio ceo core tim, mart 2026), ali ima manje zastupljenosti u AI trening podacima — veći rizik od suptilnih AI-generisanih grešaka. |
| Next.js | React Router v7, Astro | Manje poznati okviri sa manje AI "znanja" o njima — loš kompromis kad AI piše većinu koda. Problem lock-in-a rešen odlukom da se koristi self-hosted režim, ne promenom okvira. |
