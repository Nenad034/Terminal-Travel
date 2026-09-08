describe('throttleLimit', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  it('vraća produkcijsku vrednost kad NODE_ENV nije "test"', async () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { throttleLimit } = await import('./auth-throttle');
    expect(throttleLimit(10)).toBe(10);
  });

  it('vraća znatno veću vrednost pod Jest-om (NODE_ENV=test) — e2e ne sme sam sebe blokirati', async () => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const { throttleLimit } = await import('./auth-throttle');
    expect(throttleLimit(10)).toBeGreaterThan(1000);
  });
});
