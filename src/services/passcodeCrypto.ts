function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isValidFourDigitCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

export function generateSaltHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashFourDigitCode(saltHex: string, code: string): Promise<string> {
  if (!crypto?.subtle) {
    throw new Error('Secure Web Crypto is required to protect passcodes.');
  }
  const encoded = new TextEncoder().encode(`${saltHex}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifySaltedFourDigitCode(
  saltHex: string,
  expectedHashHex: string,
  code: string
): Promise<boolean> {
  if (!isValidFourDigitCode(code) || !saltHex || !expectedHashHex) {
    return false;
  }
  const computed = await hashFourDigitCode(saltHex, code);
  return computed === expectedHashHex;
}
