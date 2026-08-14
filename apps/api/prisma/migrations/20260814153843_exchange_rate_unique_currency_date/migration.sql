-- M10 spec: NBS dnevni uvoz kursa mora biti idempotentan (isti dan/valuta se ne duplira)
ALTER TABLE "exchange_rate_snapshots" ADD CONSTRAINT "exchange_rate_snapshots_currency_rate_date_key" UNIQUE ("currency", "rate_date");
