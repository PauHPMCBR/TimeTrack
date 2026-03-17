"use client";

import { useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useNotifications } from "@/context/NotificationContext";
import { useI18n } from "@/app/i18n";

export function useApiNotifications() {
  const { showNotification } = useNotifications();
  const { t } = useI18n();

  useEffect(() => {
    apiClient.setErrorListener((error) => {
      // Logic to translate and show notification
      const message = t(`error.${error}`) !== `error.${error}` 
        ? t(`error.${error}`) 
        : error;
      
      showNotification({
        type: "error",
        message: message
      });
    });

    return () => {
      apiClient.setErrorListener(null);
    };
  }, [showNotification, t]);
}
