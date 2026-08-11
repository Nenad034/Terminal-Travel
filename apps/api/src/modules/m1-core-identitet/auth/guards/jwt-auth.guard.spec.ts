import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string | undefined>) {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    __request: request,
  } as any;
}

describe('JwtAuthGuard (M1 spec §3.7 — access token nosi samo user_id/session_id)', () => {
  const jwt = new JwtService({ secret: 'test-jwt-secret-for-unit-tests' });
  const guard = new JwtAuthGuard(jwt);

  it('baca UnauthorizedException kad nedostaje Authorization header', () => {
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it('baca UnauthorizedException kad header ne počinje sa "Bearer "', () => {
    expect(() => guard.canActivate(makeContext({ authorization: 'Basic xyz' }))).toThrow(UnauthorizedException);
  });

  it('baca UnauthorizedException za nevažeći/izmenjen token', () => {
    expect(() => guard.canActivate(makeContext({ authorization: 'Bearer nije-pravi-jwt' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('baca UnauthorizedException za istekao token', () => {
    const expired = jwt.sign({ sub: 'u1', sessionId: 's1' }, { expiresIn: -10 });
    expect(() => guard.canActivate(makeContext({ authorization: `Bearer ${expired}` }))).toThrow(
      UnauthorizedException,
    );
  });

  it('validan token: postavlja request.user na {userId, sessionId} i vraća true', () => {
    const token = jwt.sign({ sub: 'u1', sessionId: 's1' });
    const context = makeContext({ authorization: `Bearer ${token}` });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(context.__request.user).toEqual({ userId: 'u1', sessionId: 's1' });
  });

  it('token ne nosi nikakav podatak o pravima — request.user ima samo userId/sessionId', () => {
    const token = jwt.sign({ sub: 'u1', sessionId: 's1' });
    const context = makeContext({ authorization: `Bearer ${token}` });

    guard.canActivate(context);

    expect(Object.keys(context.__request.user)).toEqual(['userId', 'sessionId']);
  });
});
