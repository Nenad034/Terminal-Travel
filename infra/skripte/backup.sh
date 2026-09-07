#!/usr/bin/env bash
# Dnevna rezervna kopija baze. Pokrece je systemd tajmer na serveru (vidi prvo-podesavanje.yaml).
#
# Kopija se SIFRUJE pre nego sto napusti masinu — zahtev "enkripcija podataka u mirovanju"
# iz Master dokumenta, poglavlje 9. U bazi su licni podaci gostiju; nesifrovana kopija na
# tudjem skladistu bila bi ista ta baza, samo bez ijedne brave.
set -euo pipefail

DATUM="$(date -u +%Y-%m-%d-%H%M)"
RADNI="/mnt/podaci/backup"
CILJ="$RADNI/terminal-$DATUM.sql.gz.age"

mkdir -p "$RADNI"

# `--no-owner` da se kopija moze vratiti i u bazu sa drugim korisnickim imenom (npr. pri
# proveri oporavka nize, koja radi u zasebnom kontejneru).
docker compose -f /opt/terminal/docker-compose.prod.yml exec -T postgres \
  pg_dump --no-owner --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip -9 \
  | age --encrypt --recipient "$BACKUP_KLJUC" --output "$CILJ"

echo "napravljena kopija: $CILJ ($(du -h "$CILJ" | cut -f1))"

# Slanje na DRUGO mesto. Kopija koja stoji samo na istoj masini ne stiti od gubitka masine —
# a upravo je gubitak masine slucaj zbog kog kopija i postoji.
if [ -n "${ODREDISTE_KOPIJA:-}" ]; then
  rclone copy "$CILJ" "$ODREDISTE_KOPIJA" --log-level INFO
  echo "poslato na: $ODREDISTE_KOPIJA"
else
  echo "UPOZORENJE: ODREDISTE_KOPIJA nije podeseno — kopija ostaje SAMO na ovoj masini." >&2
  exit 1
fi

# Cuvanje 30 dana lokalno; na udaljenom skladistu politika se podesava tamo.
find "$RADNI" -name 'terminal-*.sql.gz.age' -mtime +30 -delete
