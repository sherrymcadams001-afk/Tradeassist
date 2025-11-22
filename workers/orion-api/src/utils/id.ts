type CryptoProvider = {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

export function createId(): string {
  const cryptoObj = (globalThis as { crypto?: CryptoProvider }).crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  if (!cryptoObj?.getRandomValues) {
    throw new Error("crypto API unavailable");
  }
  const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}