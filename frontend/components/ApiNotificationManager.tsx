"use client";

import { useApiNotifications } from "@/hooks/useApiNotifications";

export function ApiNotificationManager() {
  useApiNotifications();
  return null;
}
