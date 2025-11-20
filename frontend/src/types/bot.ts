export type BotDescriptor = {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  universes: string[];
  control_modes: string[];
};

export type TierDefinition = {
  id: string;
  label: string;
  description: string;
  max_allocation: number;
  features: string[];
  capabilities: string[];
};

export type UserPreferences = {
  max_allocation: number;
  symbols_whitelist: string[];
  notification_level: "silent" | "summary" | "verbose";
  explanation_level: "concise" | "detailed";
};

export type UserProfile = {
  user_id: string;
  tier: string;
  preferences: UserPreferences;
  updated_at: number;
};