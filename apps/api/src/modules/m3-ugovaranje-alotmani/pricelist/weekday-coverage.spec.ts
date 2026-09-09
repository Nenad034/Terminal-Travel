import {
  danUNedelji,
  daniReda,
  imenaDana,
  nadjiPreklapanje,
  nepokriveniDani,
  proveriTurnus,
  vaziZaDan,
} from './weekday-coverage';

/**
 * M3 §2.11d — dani u nedelji i turnusi.
 *
 * Primer je vlasnikov: hotel kod koga „vikend" znači petak i subota, pa je vikend cena drugi
 * cenovni red sa drugim danima, a ne nova sezona.
 */
describe('weekday-coverage (M3 §2.11d)', () => {
  const nedCet = { boardType: 'BB', occupancy: '2ADT', validWeekdays: [7, 1, 2, 3, 4] };
  const petSub = { boardType: 'BB', occupancy: '2ADT', validWeekdays: [5, 6] };

  describe('danUNedelji — ISO, nedelja je 7 a ne 0', () => {
    it('ponedeljak je 1, nedelja je 7', () => {
      expect(danUNedelji(new Date('2027-06-07T00:00:00Z'))).toBe(1); // ponedeljak
      expect(danUNedelji(new Date('2027-06-13T00:00:00Z'))).toBe(7); // nedelja
    });
  });

  describe('prazan niz = svi dani', () => {
    it('red bez izabranih dana važi svaki dan — zatečeni zapisi se ne smeju promeniti', () => {
      const svi = { boardType: 'BB', occupancy: '2ADT', validWeekdays: [] };
      expect(daniReda(svi)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(vaziZaDan(svi, new Date('2027-06-12T00:00:00Z'))).toBe(true);
    });

    it('red sa danima važi samo za svoje', () => {
      expect(vaziZaDan(petSub, new Date('2027-06-11T00:00:00Z'))).toBe(true); // petak
      expect(vaziZaDan(petSub, new Date('2027-06-13T00:00:00Z'))).toBe(false); // nedelja
    });
  });

  describe('nadjiPreklapanje — dva reda ne smeju dati dve cene za isti datum', () => {
    it('ned–čet i pet–sub se ne preklapaju — oba prolaze', () => {
      expect(nadjiPreklapanje(petSub, [nedCet])).toEqual([]);
    });

    it('red koji pokriva petak sudara se sa vikend cenom, i poruka imenuje dan', () => {
      const sudar = { boardType: 'BB', occupancy: '2ADT', validWeekdays: [4, 5] };
      expect(nadjiPreklapanje(sudar, [nedCet, petSub])).toEqual([4, 5]);
      expect(imenaDana([4, 5])).toBe('četvrtak i petak');
    });

    it('drugi pansion je druga kombinacija — isti dani se tu ne sudaraju', () => {
      const drugiPansion = { boardType: 'HB', occupancy: '2ADT', validWeekdays: [5, 6] };
      expect(nadjiPreklapanje(drugiPansion, [petSub])).toEqual([]);
    });

    it('druga popunjenost je druga kombinacija', () => {
      const drugaPopunjenost = { boardType: 'BB', occupancy: '1ADT', validWeekdays: [5, 6] };
      expect(nadjiPreklapanje(drugaPopunjenost, [petSub])).toEqual([]);
    });

    it('izmena reda nije sudar sa samim sobom', () => {
      const isti = { id: 'rl1', boardType: 'BB', occupancy: '2ADT', validWeekdays: [5, 6] };
      expect(nadjiPreklapanje(isti, [{ ...isti }])).toEqual([]);
    });

    it('red BEZ dana preko postojećeg reda sa danima je sudar — „svi dani" uključuju i njegove', () => {
      const svi = { boardType: 'BB', occupancy: '2ADT', validWeekdays: [] };
      expect(nadjiPreklapanje(svi, [petSub])).toEqual([5, 6]);
    });
  });

  describe('nepokriveniDani — upozorenje, ne odbijanje (unos ide red po red)', () => {
    it('sam red ned–čet ostavlja petak i subotu nepokrivene', () => {
      expect(nepokriveniDani([nedCet])).toEqual([5, 6]);
    });

    it('kad se doda vikend red, nema nepokrivenih dana', () => {
      expect(nepokriveniDani([nedCet, petSub])).toEqual([]);
    });

    it('prazna kombinacija nema šta da pokrije — ne prijavljuje se sedam dana', () => {
      expect(nepokriveniDani([])).toEqual([]);
    });
  });

  describe('proveriTurnus — subota–subota, 7 ili 14 noći', () => {
    const turnus = { arrivalWeekdays: [6], departureWeekdays: [6], allowedStayNights: [7, 14] };

    it('subota → subota, 7 noći prolazi', () => {
      expect(
        proveriTurnus(turnus, {
          od: new Date('2027-06-12T00:00:00Z'),
          do: new Date('2027-06-19T00:00:00Z'),
        }),
      ).toBeNull();
    });

    it('dolazak u sredu se odbija, i poruka kaže kada se SME doći', () => {
      const razlog = proveriTurnus(turnus, {
        od: new Date('2027-06-09T00:00:00Z'),
        do: new Date('2027-06-16T00:00:00Z'),
      });
      expect(razlog).toContain('Prijava je moguća samo: subota');
    });

    it('subota → subota ali 21 noć se odbija zbog dužine, ne zbog dana', () => {
      const razlog = proveriTurnus(turnus, {
        od: new Date('2027-06-12T00:00:00Z'),
        do: new Date('2027-07-03T00:00:00Z'),
      });
      expect(razlog).toContain('7 / 14');
      expect(razlog).toContain('21');
    });

    it('period bez ograničenja pušta svaki boravak — prazno nikad ne znači „ne važi"', () => {
      expect(
        proveriTurnus(
          { arrivalWeekdays: [], departureWeekdays: [], allowedStayNights: [] },
          {
            od: new Date('2027-06-09T00:00:00Z'),
            do: new Date('2027-06-13T00:00:00Z'),
          },
        ),
      ).toBeNull();
    });
  });
});
