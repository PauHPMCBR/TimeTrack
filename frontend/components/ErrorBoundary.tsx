"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { useI18n } from "@/app/i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorBoundaryFallback({ error, onReset }: { error: Error | null, onReset: () => void }) {
  const { t } = useI18n();
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Alert
          variant="destructive"
          title={t("errorBoundary.title")}
          onClose={onReset}
        >
          {error?.message || t("errorBoundary.message")}
        </Alert>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-2 px-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          {t("errorBoundary.reload")}
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorBoundaryFallback 
          error={this.state.error} 
          onReset={() => this.setState({ hasError: false, error: null })} 
        />
      );
    }

    return this.props.children;
  }
}
