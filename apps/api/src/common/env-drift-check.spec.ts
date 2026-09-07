import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { checkEnvDrift } from './env-drift-check';

// Nalaz 4.4 (dok. 39) — dokaz da provera stvarno hvata razmimoilaženje, ne samo da ćuti
// nad ispravnim stanjem (dok. 40, pravilo 3: nova provera se dokazuje obaranjem).
describe('checkEnvDrift', () => {
  let dir: string;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'env-drift-'));
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  it('upozorava kad .env nedostaje promenljiva iz .env.example', () => {
    writeFileSync(join(dir, '.env.example'), 'DATABASE_URL=x\nJWT_SECRET=y\n');
    writeFileSync(join(dir, '.env'), 'DATABASE_URL=x\n');

    checkEnvDrift(dir);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('JWT_SECRET');
  });

  it('ne upozorava kad su .env i .env.example usklađeni', () => {
    writeFileSync(join(dir, '.env.example'), 'DATABASE_URL=x\nJWT_SECRET=y\n');
    writeFileSync(join(dir, '.env'), 'DATABASE_URL=x\nJWT_SECRET=stvarna-vrednost\n');

    checkEnvDrift(dir);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('ne ruši se kad .env fajl uopšte ne postoji (npr. CI koji čita samo env vars)', () => {
    writeFileSync(join(dir, '.env.example'), 'DATABASE_URL=x\n');

    expect(() => checkEnvDrift(dir)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('ne ruši se i ne upozorava kad ni .env.example ne postoji', () => {
    expect(() => checkEnvDrift(dir)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
