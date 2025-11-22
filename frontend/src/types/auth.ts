export type AuthUser = {
  userId: string;
  email: string;
  name?: string | null;
  roles: string[];
  expiresAt: number;
};

export type ApiKeyRecord = {
  id: string;
  user_id?: string; // backend currently omits this when serializing, kept for compatibility
  userId?: string;
  label: string;
  provider: string;
  public_key: string;
  publicKey?: string;
  last4: string;
  created_at: number;
  updated_at: number;
};

export type ApiKeyPayload = {
  label: string;
  provider: string;
  publicKey: string;
  secret: string;
  passphrase?: string;
};

export function normalizeApiKey(record: ApiKeyRecord): ApiKeyRecord {
  const publicKey = record.public_key ?? record.publicKey ?? "";
  const userId = record.user_id ?? record.userId;
  return {
    ...record,
    public_key: publicKey,
    publicKey,
    user_id: userId,
    userId,
  };
}