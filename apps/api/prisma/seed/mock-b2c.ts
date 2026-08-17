/**
 * MOCK PODACI ZA JAVAN SAJT (M8) — samo za lokalni razvoj, nikad za produkciju.
 *
 * Svrha: napuniti bazu tako da SVAKA stranica sajta ima šta da prikaže, da se izgled može
 * videti uživo (zahtev vlasnika, 17.8.2026). Do sada je katalog imao 21 ACTIVE proizvod, ali
 * ni jedan sa `B2C_SITE` u `visible_channels`, pa je javni endpoint vraćao praznu listu i sajt
 * je bio prazan na svakoj stranici.
 *
 * SVE što ova skripta napravi nosi marker `MOCK_MARKER` u nazivu/slug-u, pa `mock-b2c-clean.ts`
 * može da obriše tačno to i ništa drugo. Namerno se NE dira postojeći `seed.ts` (uloge, dozvole,
 * sistemski korisnici) — ovo je dodatak, ne zamena.
 *
 * Pokretanje:
 *   npm run seed:mock-b2c        (iz apps/api)
 *   npm run seed:mock-b2c:clean  (uklanjanje)
 */
import { PrismaClient, LanguageCode } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

export const MOCK_MARKER = 'MOCK-B2C';
const GUEST_EMAIL = 'gost.mock@terminal-travel.local';
const GUEST_PASSWORD = 'MockGost123!';

// Cene su u najmanjoj jedinici valute ugovora (EUR centi), po konvenciji iz M3 RateLine.price.
const eur = (amount: number) => Math.round(amount * 100);

async function main() {
  console.log('--- MOCK B2C podaci ---');

  // ==========================================================================
  // 1. Dobavljač + ugovor + periodi + cene (M3) — bez ovoga M5 /search ne vraća
  //    ni jednu ponudu, jer se cena za CONTRACTED proizvod čita iz ugovora.
  // ==========================================================================
  const supplier = await prisma.supplier.create({
    data: {
      name: `${MOCK_MARKER} Jadran Hoteli d.o.o.`,
      type: 'HOTEL',
      taxId: `${MOCK_MARKER}-100000001`,
      registrationNumber: `${MOCK_MARKER}-20000001`,
      country: 'Crna Gora',
      contactName: 'Milica Vuković',
      contactEmail: 'rezervacije@jadran-hoteli.example',
      contactPhone: '+382 30 123 456',
      status: 'ACTIVE',
    },
  });

  // Marža na nivou dobavljača — garantuje da se pravilo razreši za sve mock proizvode
  // (M5 §2.1 traži pravilo u lancu, inače kreiranje ponude pada).
  await prisma.markupRule.create({
    data: { scopeType: 'M3_SUPPLIER', scopeId: supplier.id, percentage: 18, createdBy: null },
  });

  const contract = await prisma.contract.create({
    data: {
      supplierId: supplier.id,
      contractNumber: `${MOCK_MARKER}/2026-001`,
      currency: 'EUR',
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2027-12-31'),
      cancellationTermsSummary: 'Bez naplate do 21 dan pre dolaska, potom 30% cene aranžmana.',
      documentUrl: 'https://primer.rs/mock/ugovor-2026-001.pdf',
      paymentTermsDays: 30,
      status: 'ACTIVE',
      defaultTipNastupanja: 'ORGANIZATOR',
    },
  });

  // Dva perioda pokrivaju leto i jesen 2026 — sajt ima ponudu i za datume koje gost izabere
  // odmah i za one nekoliko meseci unapred.
  const periods = await Promise.all(
    [
      { stayFrom: '2026-06-01', stayTo: '2026-09-30', roomType: 'DBL', capacity: 40 },
      { stayFrom: '2026-10-01', stayTo: '2027-03-31', roomType: 'DBL', capacity: 25 },
    ].map((p) =>
      prisma.contractPeriod.create({
        data: {
          contractId: contract.id,
          stayFrom: new Date(p.stayFrom),
          stayTo: new Date(p.stayTo),
          roomType: p.roomType,
          allotmentMode: 'FIXED',
          totalCapacity: p.capacity,
          unitsSold: 0,
          releaseDaysBefore: 14,
        },
      }),
    ),
  );

  for (const [i, period] of periods.entries()) {
    await prisma.rateLine.createMany({
      data: [
        { contractPeriodId: period.id, boardType: 'HB', occupancy: '2+0', priceBasis: 'PER_ROOM_PER_NIGHT', price: eur(i === 0 ? 86 : 62) },
        { contractPeriodId: period.id, boardType: 'BB', occupancy: '2+0', priceBasis: 'PER_ROOM_PER_NIGHT', price: eur(i === 0 ? 71 : 48) },
        { contractPeriodId: period.id, boardType: 'HB', occupancy: '2+1', priceBasis: 'PER_ROOM_PER_NIGHT', price: eur(i === 0 ? 104 : 78) },
      ],
    });
    await prisma.cancellationRule.create({
      data: {
        contractPeriodId: period.id,
        daysBeforeStay: 21,
        refundPercentage: 70, // 30% kazne = 70% povraćaja (M3 CancellationRule je POVRAĆAJ, ne kazna)
      },
    });
  }
  console.log(`  dobavljač + ugovor + ${periods.length} perioda sa cenama`);

  // ==========================================================================
  // 2. Proizvodi (M2) — različiti tipovi, da svaka kategorija na sajtu ima sadržaj.
  //    `visibleChannels: ['B2C_SITE']` je ono što je do sad nedostajalo.
  // ==========================================================================
  const roomTypes = [
    { code: 'DBL', name: 'Dvokrevetna soba', maxAdults: 2, maxChildren: 1 },
    { code: 'SGL', name: 'Jednokrevetna soba', maxAdults: 1, maxChildren: 0 },
  ];

  const productDefs = [
    {
      type: 'ACCOMMODATION' as const, country: 'Crna Gora', city: 'Budva',
      sr: { name: 'Hotel Avala Resort', slug: 'hotel-avala-resort', desc: 'Hotel prvog reda do mora u srcu Budve, 200 m od Starog grada. Dva bazena, spa centar i restoran sa terasom nad plažom. Sobe sa balkonom i pogledom na more, klima, sef i besplatan Wi-Fi.\n\nDoručak i večera su na bazi švedskog stola, sa lokalnim specijalitetima i dnevno svežom ribom. Za goste sa decom obezbeđen je animacijski program tokom jula i avgusta.' },
      en: { name: 'Hotel Avala Resort', slug: 'hotel-avala-resort-en', desc: 'Beachfront hotel in the heart of Budva, 200 m from the Old Town. Two pools, spa and a terrace restaurant above the beach.' },
    },
    {
      type: 'ACCOMMODATION' as const, country: 'Grčka', city: 'Halkidiki',
      sr: { name: 'Blue Bay Hotel', slug: 'blue-bay-hotel', desc: 'Mirna uvala na Kasandri, 50 m od peščane plaže sa plavom zastavom. Porodični hotel sa velikom baštom, bazenom i igraonicom za decu.\n\nPolupansion uključuje doručak i večeru; taverna u dvorištu radi do ponoći. Do Solunskog aerodroma je 95 km, transfer se organizuje po dogovoru.' },
      en: { name: 'Blue Bay Hotel', slug: 'blue-bay-hotel-en', desc: 'Quiet bay on Kassandra, 50 m from a blue-flag sandy beach. Family hotel with a large garden and pool.' },
    },
    {
      type: 'ACCOMMODATION' as const, country: 'Srbija', city: 'Zlatibor',
      sr: { name: 'Apartmani Vidikovac', slug: 'apartmani-vidikovac', desc: 'Apartmani na obodu šume, 1,2 km od centra Zlatibora. Svaki apartman ima kuhinju, kamin i terasu sa pogledom na Tornik.\n\nZimi je ski-bus stajalište na 300 m, leti staza za planinarenje počinje ispred objekta.' },
      en: { name: 'Vidikovac Apartments', slug: 'vidikovac-apartments-en', desc: 'Apartments at the forest edge, 1.2 km from the centre of Zlatibor, each with a kitchen and terrace.' },
    },
    {
      type: 'PACKAGE' as const, country: 'Italija', city: 'Rim',
      sr: { name: 'Rim — tri dana u večnom gradu', slug: 'rim-tri-dana', desc: 'Autobuski aranžman iz Beograda: dva noćenja sa doručkom u hotelu 3*, panoramsko razgledanje i pola dana slobodno za Vatikan.\n\nU cenu je uključen prevoz, smeštaj, vodič i putno osiguranje. Nije uključeno: gradska taksa (3 € po osobi po noći) i ulaznice.' },
      en: { name: 'Rome — three days in the eternal city', slug: 'rome-three-days-en', desc: 'Coach package from Belgrade: two nights with breakfast in a 3* hotel, panoramic sightseeing and half a day free.' },
    },
    {
      type: 'PACKAGE' as const, country: 'Turska', city: 'Antalija',
      sr: { name: 'Antalija — sedam noći all inclusive', slug: 'antalija-sedam-noci', desc: 'Čarter let iz Beograda, sedam noćenja po sistemu all inclusive u hotelu 5* na plaži u Larai.\n\nU cenu su uključeni let, transfer aerodrom–hotel, smeštaj i sve obroke sa domaćim pićima. Sopstvena plaža sa ležaljkama i suncobranima bez doplate.' },
      en: { name: 'Antalya — seven nights all inclusive', slug: 'antalya-seven-nights-en', desc: 'Charter flight from Belgrade, seven all-inclusive nights in a 5* beach hotel in Lara.' },
    },
    {
      type: 'EXCURSION' as const, country: 'Crna Gora', city: 'Kotor',
      sr: { name: 'Boka Kotorska brodom — celodnevni izlet', slug: 'boka-kotorska-brodom', desc: 'Celodnevna plovidba Bokokotorskim zalivom sa obilaskom Gospe od Škrpjela i Plave pećine. Pauza za kupanje u Žanjicama i ručak na brodu.\n\nPolazak u 9.00 iz Kotora, vraćanje oko 17.30. Izlet se ne organizuje pri jakom jugu.' },
      en: { name: 'Bay of Kotor by boat — full-day trip', slug: 'bay-of-kotor-by-boat-en', desc: 'Full-day cruise of the Bay of Kotor with Our Lady of the Rocks and the Blue Cave.' },
    },
    {
      type: 'TRANSFER' as const, country: 'Grčka', city: 'Solun',
      sr: { name: 'Transfer aerodrom Solun — Halkidiki', slug: 'transfer-solun-halkidiki', desc: 'Privatni transfer klimatizovanim kombijem od aerodroma "Makedonija" do smeštaja na Kasandri ili Sitoniji.\n\nVozač čeka u dolasku sa tablom sa imenom. Cena je po vozilu, do 7 putnika sa prtljagom.' },
      en: { name: 'Thessaloniki airport transfer — Halkidiki', slug: 'thessaloniki-transfer-halkidiki-en', desc: 'Private air-conditioned van transfer from Thessaloniki airport to Kassandra or Sithonia.' },
    },
    {
      type: 'EXCURSION' as const, country: 'Srbija', city: 'Novi Sad',
      sr: { name: 'Fruška gora i Sremski Karlovci', slug: 'fruska-gora-sremski-karlovci', desc: 'Poludnevni izlet iz Novog Sada: manastir Krušedol, degustacija u karlovačkom podrumu i šetnja centrom Sremskih Karlovaca.\n\nPolazak subotom u 10.00, trajanje oko pet sati. Minimum osam prijavljenih putnika.' },
      en: { name: 'Fruška Gora and Sremski Karlovci', slug: 'fruska-gora-karlovci-en', desc: 'Half-day trip from Novi Sad: Krušedol monastery, a wine cellar tasting and a walk through Sremski Karlovci.' },
    },
  ];

  const products = [];
  for (const def of productDefs) {
    const product = await prisma.product.create({
      data: {
        type: def.type,
        sourceType: 'CONTRACTED',
        sourceContractId: contract.id,
        destinationCountry: def.country,
        destinationCity: def.city,
        // Galerija je namerno prazna: nijedna stranica sajta još ne iscrtava <img>, prikazuje
        // obojen okvir sa tipom proizvoda. Lažni URL-ovi bi samo proizveli slomljene slike.
        media: [],
        attributes: def.type === 'ACCOMMODATION' ? { roomTypes, amenities: ['WIFI', 'POOL', 'PARKING', 'AIR_CONDITIONING'] } : { roomTypes },
        status: 'ACTIVE',
        visibleChannels: ['B2C_SITE'],
        createdBy: null,
        translations: {
          create: [
            { languageCode: LanguageCode.sr, name: def.sr.name, description: def.sr.desc, slug: def.sr.slug, translationSource: 'MANUAL', isReviewed: true },
            { languageCode: LanguageCode.en, name: def.en.name, description: def.en.desc, slug: def.en.slug, translationSource: 'MANUAL', isReviewed: true },
          ],
        },
      },
    });
    products.push(product);
  }
  console.log(`  ${products.length} proizvoda (${[...new Set(productDefs.map((d) => d.type))].join(', ')}) vidljivih na B2C_SITE`);

  // ==========================================================================
  // 3. Opšte stranice i blog (M12) — /stranica/[slug] i /blog/[slug]
  // ==========================================================================
  const contentDefs = [
    {
      type: 'STATIC_PAGE' as const, slug: 'o-nama',
      sr: { title: 'O nama', body: 'Terminal Travel je turistička agencija iz Beograda, osnovana 2009. godine. Organizujemo sopstvene autobuske i čarter aranžmane, i posredujemo u prodaji smeštaja preko sopstvenih ugovora sa hotelima na Mediteranu.\n\nImamo licencu OTP kategorije A i garanciju putovanja kod osiguravajuće kuće, u skladu sa Zakonom o turizmu. Sedište je u Beogradu, a poslovnice u Novom Sadu i Nišu.' },
      en: { title: 'About us', body: 'Terminal Travel is a Belgrade travel agency founded in 2009, organising its own coach and charter packages.' },
    },
    {
      type: 'STATIC_PAGE' as const, slug: 'kontakt',
      sr: { title: 'Kontakt', body: 'Beograd — Knez Mihailova 00, 011/000-0000, radnim danima 9–19, subotom 9–14.\n\nNovi Sad — Zmaj Jovina 00, 021/000-000.\n\nDežurni telefon za putnike na putu, dostupan 24 sata: 060/000-0000.\n\nEmail: office@terminal-travel.example' },
      en: { title: 'Contact', body: 'Belgrade — Knez Mihailova 00, +381 11 000 0000, weekdays 9–19, Saturday 9–14.' },
    },
    {
      type: 'BLOG_POST' as const, slug: 'pet-plaza-crne-gore-bez-gomile',
      sr: { title: 'Pet plaža u Crnoj Gori koje nisu prepune u avgustu', body: 'Budva i Bečići su u avgustu puni — ali Crna Gora ima 293 km obale, i dobar deo tih plaža nikad ne vidi gužvu. Evo pet mesta do kojih se stiže za manje od sata iz najvećih letovališta.\n\n**Ploče, Krašići.** Betonske platforme u Boki, sa bazenima izdubljenim u kamenu. Dolazak najbolje brodom iz Herceg Novog.\n\n**Kraljičina plaža, Čanj.** Šljunak i borova senka, dostupna samo brodom iz Čanja — zbog toga i prazna.\n\n**Drobni pijesak.** Uvala između Petrovca i Rijeke Reževići, sa dva restorana i bez ijednog hotela.\n\n**Valdanos, Ulcinj.** Uvala pod maslinjakom od 80.000 stabala; voda je hladnija nego u okolini jer u nju ulaze izvori.\n\n**Velika plaža, ali južni deo.** Prvih kilometar je pun, sledećih deset gotovo prazno — potrebna su kola ili bicikl.' },
      en: { title: 'Five Montenegrin beaches that are not packed in August', body: 'Budva is full in August, but Montenegro has 293 km of coast. Here are five spots less than an hour from the main resorts.' },
    },
    {
      type: 'BLOG_POST' as const, slug: 'kako-spakovati-kofer-za-autobuski-aranzman',
      sr: { title: 'Kako spakovati kofer za autobuski aranžman', body: 'Autobus nije avion — ograničenja su drugačija, i par sitnica čini razliku između udobnog i mučnog puta.\n\n**Ručni prtljag je važniji od velikog.** Sve što vam treba u toku 14 sati vožnje mora biti kod sedišta, jer se prtljažnik otvara samo na dužim pauzama.\n\n**Voda i hrana za prvih šest sati.** Prva duža pauza je obično posle četiri do pet sati.\n\n**Dokumenti u istoj torbi, ne razdvojeni.** Na granici se traže odjednom — pasoš, polisa osiguranja i vaučer.\n\n**Jakna, i u julu.** Klima u autobusu radi na celu putničku kabinu i ne može se regulisati po sedištu.\n\n**Lekovi u ručnom prtljagu, u originalnoj kutiji.** Ako putujete sa receptom, nosite i njega.' },
      en: { title: 'How to pack for a coach trip', body: 'A coach is not a plane — the constraints differ, and a few details separate a comfortable ride from a miserable one.' },
    },
  ];

  for (const def of contentDefs) {
    await prisma.contentPiece.create({
      data: {
        type: def.type,
        slug: def.slug,
        trackingCode: `${MOCK_MARKER.slice(0, 4)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        // M12 §3b — javan endpoint vraća stranicu SAMO ako nosi M8_SITE kanal
        // (`ContentService.findPublishedBySlug`); bez toga sajt daje 404.
        targetChannels: ['M8_SITE'],
        containsAiGeneratedMedia: false,
        status: 'PUBLISHED',
        generatedBy: 'HUMAN',
        approvedBy: null,
        publishedAt: new Date(),
        translations: {
          create: [
            { languageCode: LanguageCode.sr, title: def.sr.title, body: def.sr.body, translationSource: 'MANUAL', isReviewed: true },
            { languageCode: LanguageCode.en, title: def.en.title, body: def.en.body, translationSource: 'MANUAL', isReviewed: true },
          ],
        },
      },
    });
  }
  console.log(`  ${contentDefs.length} M12 stranica/članaka (PUBLISHED)`);

  // ==========================================================================
  // 4. Članak baze znanja (M23) — /znanje/[shareToken], stranica koja se deli gostu
  // ==========================================================================
  const shareToken = `${MOCK_MARKER.toLowerCase()}-budva-vodic`;
  await prisma.article.create({
    data: {
      subjectType: 'DESTINATION',
      destinationCountry: 'Crna Gora',
      destinationCity: 'Budva',
      status: 'PUBLISHED',
      generatedBy: 'AI',
      approvedBy: null,
      shareToken,
      lastRefreshedAt: new Date(),
      nextRefreshDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      publishedAt: new Date(),
      translations: {
        create: [
          {
            languageCode: LanguageCode.sr,
            title: 'Budva — šta treba znati pre polaska',
            body: 'Budva je najposećenije letovalište na crnogorskom primorju, sa oko 15.000 stanovnika van sezone i višestruko više tokom jula i avgusta.\n\n**Dolazak.** Aerodrom Tivat je 20 km (taksi oko 25 €), Podgorica 65 km. Autobusom iz Beograda vožnja traje 11–13 sati zavisno od zadržavanja na granici.\n\n**Plaže.** Slovenska plaža je najduža i najbliža centru, šljunkovita. Mogren se pešači 10 minuta od Starog grada uz stazu iznad mora. Jaz je 3 km severno, sa peščanim delom.\n\n**Stari grad.** Ulaz je slobodan; Citadela se plaća (oko 3,5 €) i sa nje se vidi cela Slovenska plaža.\n\n**Praktično.** Valuta je evro. Boravišna taksa je oko 1 € po osobi dnevno i najčešće se plaća na recepciji. Voda iz česme je za piće.\n\n**Kad ići.** Jun i septembar imaju more oko 23 °C i znatno manje ljudi od avgusta.',
            translationSource: 'AI_GENERATED',
          },
        ],
      },
    },
  });
  console.log(`  1 M23 članak (deljeni link: /znanje/${shareToken})`);

  // ==========================================================================
  // 5. Nalog gosta + rezervacija — /nalog/prijava, /nalog/profil, /nalog/moje-rezervacije
  // ==========================================================================
  const passwordHash = await argon2.hash(GUEST_PASSWORD, { type: argon2.argon2id });
  const guestUser = await prisma.user.create({
    data: {
      email: GUEST_EMAIL,
      fullName: 'Jovana Mock Petrović',
      passwordHash,
      accountType: 'GUEST',
      status: 'ACTIVE',
    },
  });

  // Uloga GOST — registracija je jedini put koji je normalno dodeljuje (`AuthService.register`,
  // M1 §4). Seed piše korisnika direktno, pa uloga mora ručno: bez nje gost dobija 403 na
  // `GET /sales/bookings` (Nema dozvolu M5/booking/VIEW) i "Moje rezervacije" ostaje prazno.
  const gostRole = await prisma.role.findUnique({ where: { name: 'GOST' } });
  if (gostRole) {
    await prisma.userRole.create({ data: { userId: guestUser.id, roleId: gostRole.id, assignedBy: guestUser.id } });
  }

  const clientAccount = await prisma.clientAccount.create({
    data: {
      accountType: 'INDIVIDUAL',
      fullName: 'Jovana Mock Petrović',
      email: GUEST_EMAIL,
      phone: '+381 60 000 0000',
      country: 'Srbija',
      preferredLanguage: LanguageCode.sr,
      linkedUserId: guestUser.id,
      marketingConsent: true,
      marketingConsentDate: new Date(),
    },
  });

  // KLJUČNA veza: M5/M6 razrešavaju "čiji je ovo nalog" preko `User.linkedProfileId`
  // (`resolveCallerIdentity` → ownProfileId), NE preko `ClientAccount.linkedUserId`. Bez ovoga
  // gost se uspešno prijavi, ali "Moje rezervacije" i "Profil" ostaju prazni (stvarno se desilo
  // pri izradi, 17.8.2026).
  await prisma.user.update({ where: { id: guestUser.id }, data: { linkedProfileId: clientAccount.id } });

  await prisma.guestProfile.create({
    data: {
      fullName: 'Jovana Mock Petrović',
      documentType: 'PASSPORT',
      documentNumber: `${MOCK_MARKER}-P0000001`,
      nationality: 'Srbija',
      dateOfBirth: new Date('1990-04-12'),
      email: GUEST_EMAIL,
      phone: '+381 60 000 0000',
      linkedClientAccountId: clientAccount.id,
      linkedUserId: guestUser.id,
    },
  });

  const markupRule = await prisma.markupRule.findFirstOrThrow({ where: { scopeId: supplier.id } });
  const rateLine = await prisma.rateLine.findFirstOrThrow({ where: { contractPeriodId: periods[0].id } });
  const hotel = products[0];

  const booking = await prisma.booking.create({
    data: {
      bookingNumber: `${MOCK_MARKER}-2026-0001`,
      clientAccountId: clientAccount.id,
      buyerName: 'Jovana Mock Petrović',
      buyerType: 'FIZICKO_LICE',
      channel: 'B2C_SITE',
      tipNastupanja: 'ORGANIZATOR',
      status: 'CONFIRMED',
      paymentStatus: 'PARTIALLY_PAID',
      totalPrice: eur(608),
      currency: 'EUR',
      confirmedAt: new Date(),
      createdBy: 'GOST_SELF',
      items: {
        create: [
          {
            productId: hotel.id,
            sourceType: 'CONTRACTED',
            supplierReference: `${MOCK_MARKER}-SUP-0001`,
            stayFrom: new Date('2026-07-11'),
            stayTo: new Date('2026-07-18'),
            baseCost: eur(515),
            baseCostCurrency: 'EUR',
            rateLineId: rateLine.id,
            markupRuleId: markupRule.id,
            finalPrice: eur(608),
            finalPriceCurrency: 'EUR',
            itemStatus: 'CONFIRMED',
            unitCount: 1,
          },
        ],
      },
    },
  });
  console.log(`  nalog gosta (${GUEST_EMAIL} / ${GUEST_PASSWORD}) + rezervacija ${booking.bookingNumber}`);

  console.log('\nGotovo. Stranice koje sad imaju sadržaj:');
  console.log('  /sr                                  početna (istaknute ponude)');
  console.log('  /sr/smestaj  /sr/aranzmani  /sr/izleti  /sr/transferi   kategorije');
  console.log('  /sr/smestaj/hotel-avala-resort        pojedinačan hotel (izuzet od pune širine)');
  console.log('  /sr/pretraga?destinationCity=Budva   rezultati pretrage');
  console.log('  /sr/stranica/o-nama  /sr/stranica/kontakt              opšte stranice');
  console.log('  /sr/blog/pet-plaza-crne-gore-bez-gomile                blog');
  console.log(`  /sr/znanje/${shareToken}    deljen članak`);
  console.log(`  /sr/nalog/prijava                    prijava (${GUEST_EMAIL} / ${GUEST_PASSWORD})`);
  console.log('  /sr/nalog/moje-rezervacije           rezervacije prijavljenog gosta');
}

// Pokreni SAMO kad je ovaj fajl pozvan direktno. `mock-b2c-clean.ts` uvozi MOCK_MARKER odavde —
// bez ove ograde uvoz bi izvršio i sam seed, pa bi "uklanjanje" u istom potezu ponovo ubacivalo
// podatke (stvarno se desilo pri izradi, 17.8.2026).
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
