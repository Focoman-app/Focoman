import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";

const HASH_BYTES = 64;

export function generateSixDigitPasskeyPin(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

export function hashInvitationPasscode(passcode: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passcode, salt, HASH_BYTES).toString("hex");
  return { salt, hash };
}

export function verifyInvitationPasscode(passcode: string, salt: string, expectedHash: string): boolean {
  try {
    const expected = Buffer.from(expectedHash, "hex");
    const actual = scryptSync(passcode, salt, HASH_BYTES);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function prefixLetters(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const lettersOnly = normalized.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
  if (lettersOnly.length === 3) {
    return lettersOnly;
  }
  const alphaNum = normalized.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
  return (lettersOnly || alphaNum).padEnd(3, "X");
}

export function generateTimestampDigits(date: Date = new Date()): { dateStamp: string; timeStamp: string } {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return {
    dateStamp: `${yy}${mm}${dd}`,
    timeStamp: `${hh}${min}${ss}`,
  };
}

export function generateOrderIdentifiers(studioId: string, date: Date = new Date()): {
  orderId: string;
  passkey: string;
  customerId: string;
} {
  const prefix = prefixLetters(studioId);
  const { dateStamp, timeStamp } = generateTimestampDigits(date);
  const code = `${dateStamp}-${timeStamp}`;
  const orderId = `ORD-${prefix}-${code}`;
  return {
    orderId,
    passkey: orderId,
    customerId: `cus_${Date.now()}_${randomBytes(2).toString("hex")}`,
  };
}

export function formatInvitationCode(studioName: string, memberName: string, suffix: string): string {
  if (!/^\d{4,8}$|^\d{6}-\d{2,6}$/.test(suffix)) {
    throw new Error("Invitation suffix must contain between four and eight digits or a timestamp.");
  }
  return `INV-${prefixLetters(studioName)}-${prefixLetters(memberName)}-${suffix}`;
}

export function createInvitationLinkToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInvitationLinkToken(token) };
}

export function hashInvitationLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyInvitationLinkToken(token: string, expectedHash: string): boolean {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hashInvitationLinkToken(token), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
