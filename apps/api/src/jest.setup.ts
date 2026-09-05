// Jednakо okruženje za SVAKI test fajl (5.9.2026).
//
// Zašto postoji: `provider-configs.service.spec.ts` je povremeno padao u punom prolazu, a
// prolazio kad se pokrene sam. Uzrok: taj test poziva `encryptSecret`, koji traži
// `ENCRYPTION_KEY`, ali ga sam nikad nije postavljao — radio je samo kad bi u ISTOM jest
// radniku pre njega prošao `secret-box.spec.ts`, koji tu promenljivu postavlja za sebe.
// Kad bi raspored fajlova bio drugačiji (ili bi secret-box na kraju obrisao vrednost),
// M4 test bi pao. Jest deli proces između fajlova u istom radniku, pa `process.env` curi
// između njih — a raspored zavisi od trajanja fajlova, tj. menja se od prolaza do prolaza.
//
// Rešenje je da nijedan test ne zavisi od tuđeg okruženja: vrednost se postavlja ovde, pre
// svakog fajla. `??=` da stvarno podešen `.env` (npr. lokalno) ostane netaknut.
process.env.ENCRYPTION_KEY ??= 'test-encryption-key-not-for-production';
