import * as OTPAuth from "otpauth";

export function generateTotpSecret(): string {
  const totp = new OTPAuth.TOTP({ issuer: "TGVOffice", label: "TGVOffice" });
  return totp.secret.base32;
}

export function generateTotpUri(username: string, secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "TGV Office",
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: "TGV Office",
      label: "TGVOffice",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    // Allow ±1 window (30s tolerance)
    const delta = totp.validate({ token: token.replace(/\s/g, ""), window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}
