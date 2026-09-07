# infra/ — server i njegovo podešavanje, opisani kodom

Zatvara poslednju nezatvorenu stavku **Faze 0** (`docs/00-MASTER-ARHITEKTURA.md` poglavlje 8, i
M1 izlazni kriterijum): _„Infrastruktura se diže iz IaC koda, ne ručnim koracima."_ Stajala je
otvorena od avgusta 2026, jer je čekala odluku o hosting provajderu — vlasnik ju je doneo
7.9.2026 (Hetzner, EU).

> **Ništa ovde ne troši novac dok se ne pokrene `tofu apply` sa važećim Hetzner ključem.**
> Do tada je ovo samo opis namere.

## Zašto OpenTofu

Poglavlje 6 Master dokumenta traži „infrastrukturu kao kod", ali ne imenuje alat. Izabran je
**OpenTofu**, i to je jedina nova stavka u steku ovog prolaza (upisana u poglavlje 6):

- Hetzner ima **zvanično održavan dodatak** (`hetznercloud/hcloud`), pa se server, firewall i
  disk opisuju direktno, bez posrednika.
- Otvorenog je koda pod Linux Foundation. Terraform, od kog je nastao, prešao je 2023. na
  licencu koja ograničava komercijalnu upotrebu — OpenTofu je nastao baš kao odgovor na to.
  Jezik i fajlovi su isti, pa se u svakom trenutku može preći na Terraform i obrnuto.
- **Ne mora se instalirati.** Sve komande ispod rade kroz kontejner, kao što je i provereno
  7.9.2026 (`tofu validate` → _Success! The configuration is valid._).

## Šta je gde

| Putanja                          | Šta radi                                                                 |
| :------------------------------- | :----------------------------------------------------------------------- |
| `tofu/main.tf`                   | server, firewall, odvojen disk za bazu, SSH ključ                        |
| `tofu/variables.tf`              | sve što se podešava (tip servera, lokacija, veličina diska)              |
| `tofu/prvo-podesavanje.yaml`     | šta se desi u prvom minutu života servera, pre nego što iko na njega uđe |
| `docker/*.Dockerfile`            | pakovanje API-ja, panela i sajta u slike                                 |
| `docker/docker-compose.prod.yml` | kako se sve to pokreće zajedno **na serveru**                            |
| `docker/Caddyfile`               | HTTPS i usmeravanje domena ka pravoj aplikaciji                          |
| `skripte/backup.sh`              | dnevna, šifrovana kopija baze na drugo mesto                             |
| `skripte/provera-oporavka.sh`    | nedeljni dokaz da se iz te kopije baza **stvarno može vratiti**          |

`docker-compose.yml` u korenu repozitorijuma i dalje je **samo za lokalni razvoj** — ova
fascikla ga ne menja i ne zamenjuje.

## Kako se koristi

```bash
cd infra/tofu

# Ključ se NIKAD ne upisuje u fajl — čita se iz okruženja.
export TF_VAR_hcloud_token="..."

tofu init
tofu plan     # pokaže šta bi napravio; ne menja ništa
tofu apply    # tek ovo pravi server i tek odavde ide trošak
```

Bez instaliranog OpenTofu, isto kroz kontejner:

```bash
docker run --rm -v "$(pwd):/wd" -w /wd -e TF_VAR_hcloud_token \
  ghcr.io/opentofu/opentofu:1.8 plan
```

## Šta je provereno 7.9.2026 (a ne pretpostavljeno)

| Provera                               | Rezultat                                                             |
| :------------------------------------ | :------------------------------------------------------------------- |
| `tofu validate`                       | prošlo                                                               |
| Gradnja slike API-ja                  | prošla                                                               |
| API u kontejneru nad pravom bazom     | javni katalog `200`, pretraga `200`, zaštićena ruta bez tokena `401` |
| Veličina slike API-ja                 | 2,38 GB → **859 MB** (v. „Zamke" ispod)                              |
| Samostalni izlaz sajta (`standalone`) | 31 MB umesto 1,4 GB stabla zavisnosti                                |

**Nije provereno na pravom serveru** — jer server još ne postoji. `prvo-podesavanje.yaml`,
Caddy i obe skripte za kopije prvi put se izvršavaju tek pri prvom `tofu apply`; dotle su
napisani, ali nedokazani. To se izričito navodi da se ne bi vodili kao gotovi.

## Zamke na koje se ovde već upalo

1. **Prisma bira svoj motor prema OpenSSL-u koji nađe na sistemu.** U goloj `slim` slici
   OpenSSL-a nema, pa pretpostavi staru verziju i kontejner padne pri pokretanju
   (`Unable to require libquery_engine-debian-openssl-1.1.x.so.node`). Zato se `openssl`
   instalira u **zajedničkoj osnovi** — da isti vide i gradnja i pokretanje.
2. **npm drži zavisnosti svih aplikacija na jednom mestu.** Kopiranje celog `node_modules`
   u sliku API-ja unosi `next` (202 MB), React Native alat i `@swc` — preko 600 MB koje API
   nikad ne uvozi. Rešeno instaliranjem samo `--workspace apps/api`.
3. **`.dockerignore` isključuje `apps/mobile`, ali njen `package.json` mora unutra** — `npm ci`
   nad workspace-om proverava svaki manifest prema `package-lock.json` i bez njega odbija da krene.
