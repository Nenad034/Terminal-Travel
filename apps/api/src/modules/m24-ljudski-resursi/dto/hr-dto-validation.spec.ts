import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateLeaveRecordDto } from './create-leave-record.dto';
import { UpsertEmployeeRecordDto } from './upsert-employee-record.dto';
import { UpsertLeaveEntitlementDto } from './upsert-leave-entitlement.dto';
import { UpdateBranchDto } from '../../m1-core-identitet/branches/dto/update-branch.dto';

// Zamka 13.6/13.8 — test koji dokazuje da ograda ODBIJA, kroz ISTU ValidationPipe konfiguraciju
// kao main.ts. Do 18.9.2026. ova tela su bila `interface`, pa je pipe propuštao sve (dok. 50 3.1).
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const body = (metatype: any, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype, data: undefined });

describe('M24 / M1 branches — telo zahteva se stvarno proverava', () => {
  const validLeave = {
    type: 'GODISNJI_ODMOR',
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    daysCount: 3,
  };

  it('ispravan zahtev za odsustvo prolazi (pravilo 3 dok. 40 — ograda ne odbija sve)', async () => {
    await expect(body(CreateLeaveRecordDto, validLeave)).resolves.toMatchObject(validLeave);
  });

  it.each([
    ['daysCount kao tekst', { ...validLeave, daysCount: 'tri' }],
    ['daysCount negativan (uvećao bi stanje odmora)', { ...validLeave, daysCount: -50 }],
    ['daysCount nula', { ...validLeave, daysCount: 0 }],
    ['nepoznato polje', { ...validLeave, nepoznatoPolje: 123 }],
    ['tip van enum-a', { ...validLeave, type: 'ODMOR_NA_MARSU' }],
    ['datum koji nije datum', { ...validLeave, startDate: 'nije datum' }],
  ])('odbija: %s', async (_naziv, telo) => {
    await expect(body(CreateLeaveRecordDto, telo)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('HR dosije: enum i datumi se proveravaju', async () => {
    await expect(
      body(UpsertEmployeeRecordDto, {
        employmentType: 'NESTO',
        contractBasis: 'NEODREDJENO',
        hireDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      body(UpsertEmployeeRecordDto, {
        employmentType: 'PUNO_RADNO_VREME',
        contractBasis: 'NEODREDJENO',
        hireDate: 'nije datum',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dodeljeni dani: tekst i negativan broj se odbijaju', async () => {
    await expect(body(UpsertLeaveEntitlementDto, { daysEntitled: 'abc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(body(UpsertLeaveEntitlementDto, { daysEntitled: -5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(body(UpsertLeaveEntitlementDto, { daysEntitled: 20 })).resolves.toMatchObject({
      daysEntitled: 20,
    });
  });

  it('poslovnica: nepoznato polje i pogrešan e-mail se odbijaju', async () => {
    await expect(body(UpdateBranchDto, { name: 'Centar', tajno: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(body(UpdateBranchDto, { email: 'nije-mejl' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(body(UpdateBranchDto, { name: 'Centar', active: false })).resolves.toMatchObject({
      name: 'Centar',
      active: false,
    });
  });
});
