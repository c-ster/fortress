import * as OTPAuth from 'otpauth';

export function generateMfaSecret(): { secret: string; uri: string } {
  const totp = new OTPAuth.TOTP({
    issuer: 'Fortress',
    label: 'Fortress Financial',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
  };
}

export function verifyMfaToken(secret: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: 'Fortress',
    label: 'Fortress Financial',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}
