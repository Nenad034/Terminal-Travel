#!/usr/bin/env bash
# Dokazuje da se iz poslednje kopije BAZA STVARNO MOZE VRATITI.
#
# Zasto postoji: Master dokument, poglavlje 9, trazi backup koji je "testiran (ne samo
# konfigurisan — periodicno se proverava da li se iz njega zaista moze oporaviti sistem)".
# Kopija koja se pravi svaki dan a nikad nije vracena nije rezervna kopija nego pretpostavka:
# najcesci nacin da se izgube podaci nije izostanak kopije, nego kopija koja se ne otvara.
#
# Kako radi: podigne PRAZNU, privremenu bazu u zasebnom kontejneru, ubaci poslednju kopiju u
# nju, prebroji redove u nekoliko kljucnih tabela i obrise privremenu bazu. Proizvodnu bazu
# NE DODIRUJE ni u jednom koraku.
set -euo pipefail

POSLEDNJA="$(ls -t /mnt/podaci/backup/terminal-*.sql.gz.age 2>/dev/null | head -1)"
if [ -z "$POSLEDNJA" ]; then
  echo "PAO TEST: nema nijedne kopije u /mnt/podaci/backup" >&2
  exit 1
fi

STAROST_SATI=$(( ( $(date +%s) - $(stat -c %Y "$POSLEDNJA") ) / 3600 ))
if [ "$STAROST_SATI" -gt 48 ]; then
  echo "PAO TEST: najnovija kopija je stara $STAROST_SATI sati — dnevni posao ne radi." >&2
  exit 1
fi

echo "proveravam: $POSLEDNJA (stara $STAROST_SATI h)"
KONTEJNER="provera-oporavka-$$"
docker run -d --name "$KONTEJNER" \
  -e POSTGRES_PASSWORD=samo-za-proveru \
  -e POSTGRES_DB=provera \
  pgvector/pgvector:pg16 >/dev/null

# Obrisi privremeni kontejner kako god da se skripta zavrsi (i pri gresci, i pri prekidu).
trap 'docker rm -f "$KONTEJNER" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  docker exec "$KONTEJNER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

age --decrypt --identity "$BACKUP_IDENTITET" "$POSLEDNJA" \
  | gunzip \
  | docker exec -i "$KONTEJNER" psql -U postgres -d provera -v ON_ERROR_STOP=1 >/dev/null

# Prazna baza bi takodje "uspesno" primila prazan dump — zato se broje redovi, ne samo
# proverava izlazni kod. Uloge (7 sistemskih, M1 §4) su najsigurniji pokazatelj: postoje od
# prvog seed-a i nikad ih nema nula u ispravnoj bazi.
BROJ_ULOGA="$(docker exec "$KONTEJNER" psql -U postgres -d provera -tAc 'select count(*) from roles')"
BROJ_KORISNIKA="$(docker exec "$KONTEJNER" psql -U postgres -d provera -tAc 'select count(*) from users')"

echo "vraceno iz kopije: $BROJ_ULOGA uloga, $BROJ_KORISNIKA korisnika"

if [ "$BROJ_ULOGA" -lt 7 ]; then
  echo "PAO TEST: ocekivano najmanje 7 sistemskih uloga (M1 §4), nadjeno $BROJ_ULOGA." >&2
  exit 1
fi

echo "PROVERA PROSLA — iz kopije se baza moze vratiti."
