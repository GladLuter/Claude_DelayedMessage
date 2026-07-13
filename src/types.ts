import type { Lang } from "./i18n.js";

export type TriggerType = "limits-reset" | "at";

export interface Trigger {
  type: TriggerType;
  /** ISO-время локальной доставки, только для type === "at" */
  at?: string;
}

export type Status = "pending" | "delivering" | "sent" | "failed" | "canceled";

export interface QueueItem {
  id: string;
  createdAt: string;
  sessionId: string;
  projectDir: string;
  message: string;
  trigger: Trigger;
  status: Status;
  attempts: number;
  expectedResetAt?: string;
  fallbackFromAt?: boolean;
  claimedAt?: string;
  result?: string;
}

export interface Config {
  tickIntervalMinutes: number;
  claudePath: string;
  maxAttempts: number;
  deliveryTimeoutMinutes: number;
  notifications: boolean;
  lang: Lang;
}
