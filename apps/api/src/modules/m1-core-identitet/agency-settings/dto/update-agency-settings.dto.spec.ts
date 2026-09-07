import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAgencySettingsDto } from './update-agency-settings.dto';

// REGRESIJA (7.9.2026): prva verzija ovog DTO-a je imala samo `@MinLength(1)`, pa je naziv od
// samih razmaka ('   ', duzine 3) PROLAZIO validaciju i upisivao se u bazu — na ekranu bi
// izgledao kao prazno ime agencije, na sajtu kao prazno podnožje. Nadjeno probom kroz stvaran
// HTTP poziv (vratio 200 umesto 400), ne čitanjem koda.
//
// Test gađa DTO direktno jer ova ograda živi na HTTP sloju (ValidationPipe), ne u servisu —
// unit test servisa je ne bi ni dodirnuo.
async function greske(ulaz: Record<string, unknown>) {
  const dto = plainToInstance(UpdateAgencySettingsDto, ulaz);
  return validate(dto);
}

describe('UpdateAgencySettingsDto (M1 spec §3.9c)', () => {
  it('odbija naziv od samih razmaka', async () => {
    const r = await greske({ brandName: '   ' });
    expect(r).toHaveLength(1);
    expect(JSON.stringify(r)).toContain('Naziv agencije ne sme biti prazan');
  });

  it('odbija prazan naziv', async () => {
    expect(await greske({ brandName: '' })).toHaveLength(1);
  });

  it('prihvata naziv sa razmacima oko njega i odseca ih', async () => {
    const dto = plainToInstance(UpdateAgencySettingsDto, { brandName: '  Nova Agencija  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.brandName).toBe('Nova Agencija');
  });

  // Izmena je delimična — slanje samo jednog polja ne sme da traži sva ostala.
  it('dozvoljava izmenu bez naziva (samo adresa)', async () => {
    expect(await greske({ address: 'Nova 1' })).toHaveLength(0);
  });
});
