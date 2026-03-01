const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const NUMBERS = '23456789';
const SYMBOLS = '!@#$%&*()-_=+[]{};:,.?';

const REQUIRED_SETS = [UPPERCASE, LOWERCASE, NUMBERS, SYMBOLS];
const ALL_CHARSETS = REQUIRED_SETS.join('');

export const DEFAULT_SECURE_PASSWORD_LENGTH = 12;

function getCryptoRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer.');
  }

  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random generator is unavailable.');
  }

  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const random = new Uint32Array(1);

  let value = 0;
  do {
    cryptoApi.getRandomValues(random);
    value = random[0];
  } while (value >= limit);

  return value % maxExclusive;
}

function getRandomChar(charset: string): string {
  return charset[getCryptoRandomInt(charset.length)];
}

function shuffleInPlace<T>(values: T[]): void {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = getCryptoRandomInt(i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
}

export function generateSecurePassword(
  length = DEFAULT_SECURE_PASSWORD_LENGTH
): string {
  if (!Number.isInteger(length) || length < REQUIRED_SETS.length) {
    throw new Error(`Password length must be >= ${REQUIRED_SETS.length}.`);
  }

  const passwordChars = REQUIRED_SETS.map(getRandomChar);

  while (passwordChars.length < length) {
    passwordChars.push(getRandomChar(ALL_CHARSETS));
  }

  shuffleInPlace(passwordChars);
  return passwordChars.join('');
}
