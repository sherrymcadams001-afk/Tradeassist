import { useCallback, useEffect, useMemo, useState } from "react";

import type { BotDescriptor, TierDefinition, UserPreferences, UserProfile } from "../types/bot";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type ProfilePayload = {
  tier: string;
  preferences: Partial<UserPreferences>;
};

export function useBotProfile(userId: string) {
  const [bot, setBot] = useState<BotDescriptor | null>(null);
  const [tiers, setTiers] = useState<TierDefinition[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [botResp, tiersResp, profileResp] = await Promise.all([
        fetch(`${API_BASE}/v1/bot`),
        fetch(`${API_BASE}/v1/tiers`),
        fetch(`${API_BASE}/v1/users/${userId}/profile`),
      ]);

      if (!botResp.ok || !tiersResp.ok || !profileResp.ok) {
        throw new Error("Failed to load onboarding data");
      }

      const [botJson, tiersJson, profileJson] = await Promise.all([
        botResp.json(),
        tiersResp.json(),
        profileResp.json(),
      ]);

      setBot(botJson);
      setTiers(tiersJson);
      setProfile(profileJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const saveProfile = useCallback(
    async (payload: ProfilePayload) => {
      setSaving(true);
      setError(null);
      try {
        const resp = await fetch(`${API_BASE}/v1/users/${userId}/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const detail = await resp.json().catch(() => ({}));
          throw new Error(detail?.detail ?? "Failed to save profile");
        }
        const nextProfile = (await resp.json()) as UserProfile;
        setProfile(nextProfile);
        return nextProfile;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const tierMap = useMemo(() => Object.fromEntries(tiers.map((tier) => [tier.id, tier])), [tiers]);

  return {
    bot,
    tiers,
    tierMap,
    profile,
    loading,
    error,
    saving,
    refresh,
    saveProfile,
  } as const;
}