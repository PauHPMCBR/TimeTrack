"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";

type NotificationType = "info" | "success" | "warning" | "error";

interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
}

interface NotificationContextType {
  showNotification: (params: { type?: NotificationType; title?: string; message: string }) => void;
  hideNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const hideNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback(
    ({ type = "info", title, message }: { type?: NotificationType; title?: string; message: string }) => {
      const id = Math.random().toString(36).substring(2, 9);
      setNotifications((prev) => [...prev, { id, type, title, message }]);

      // Auto-hide after 5 seconds for success/info, maybe keep errors/warnings longer?
      if (type === "success" || type === "info") {
        setTimeout(() => hideNotification(id), 5000);
      }
    },
    [hideNotification]
  );

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] w-full max-w-sm flex flex-col-reverse gap-2 pointer-events-none">
        {notifications.map((n) => (
          <div key={n.id} className="pointer-events-auto">
            <Alert
              variant={n.type === "error" ? "destructive" : n.type}
              title={n.title}
              onClose={() => hideNotification(n.id)}
            >
              {n.message}
            </Alert>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
