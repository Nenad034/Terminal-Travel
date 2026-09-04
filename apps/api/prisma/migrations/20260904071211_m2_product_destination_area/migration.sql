-- M2 spec §2.1b (4.9.2026) — opciono polje za regiju/poluostrvo odvojeno od mesta
-- (destination_city), za slucajeve kao Halkidiki (regija) / Sitonija (poluostrvo).
ALTER TABLE "products" ADD COLUMN "destination_area" TEXT;
