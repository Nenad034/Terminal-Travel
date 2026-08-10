-- M1 spec §3.8: "Tabela je append-only — na nivou baze se onemogućava UPDATE/DELETE nad njom
-- (DB rola bez tih prava, ili trigger koji odbija)." Ovde biramo trigger, jer Prisma migracije
-- ne upravljaju DB rolama/grantovima direktno, a trigger ostaje tačan bez obzira ko/šta se
-- poveže na bazu (uključujući buduće ručne konzole).
--
-- Pokrenuti posle `prisma migrate dev` (Prisma ne zna za trigere — ovo je namerno van njene šeme).

CREATE OR REPLACE FUNCTION audit_log_entries_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_entries je append-only — UPDATE/DELETE nije dozvoljeno (M1 spec §3.8)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_entries_no_update ON audit_log_entries;
CREATE TRIGGER trg_audit_log_entries_no_update
  BEFORE UPDATE ON audit_log_entries
  FOR EACH ROW EXECUTE FUNCTION audit_log_entries_append_only();

DROP TRIGGER IF EXISTS trg_audit_log_entries_no_delete ON audit_log_entries;
CREATE TRIGGER trg_audit_log_entries_no_delete
  BEFORE DELETE ON audit_log_entries
  FOR EACH ROW EXECUTE FUNCTION audit_log_entries_append_only();
