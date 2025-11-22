import { useCallback, useEffect, useMemo, useState } from "react";

import type { BotDescriptor, TierDefinition, UserPreferences, UserProfile } from "../types/bot";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type ProfilePayload = {
  tier: string;
  preferences: Partial<UserPreferences>;
};

type UseBotProfileOptions = {
  enabled?: boolean;
};

export function useBotProfile(userId?: string | null, options?: UseBotProfileOptions) {
  const [bot, setBot] = useState<BotDescriptor | null>(null);
  const [tiers, setTiers] = useState<TierDefinition[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canFetch = options?.enabled ?? true;
  const resolvedUserId = userId ?? "me";
  const profilePath = resolvedUserId === "me" ? "/v1/users/me/profile" : `/v1/users/${resolvedUserId}/profile`;

  const refresh = useCallback(async () => {
    if (!canFetch) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [botResp, tiersResp, profileResp] = await Promise.all([
        fetch(`${API_BASE}/v1/bot`, { credentials: "include" }),
        fetch(`${API_BASE}/v1/tiers`, { credentials: "include" }),
        fetch(`${API_BASE}${profilePath}`, { credentials: "include" }),
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
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [canFetch, profilePath]);

  const saveProfile = useCallback(
    async (payload: ProfilePayload) => {
      if (!canFetch) {
        throw new Error("Authentication required");
      }
      setSaving(true);
      setError(null);
      try {
        const resp = await fetch(`${API_BASE}${profilePath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
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
    [canFetch, profilePath]
  );

  useEffect(() => {
    void refresh();
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