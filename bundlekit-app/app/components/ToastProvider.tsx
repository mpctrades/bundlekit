import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Frame, Toast } from "@shopify/polaris";

interface ToastContextValue {
  showToast: (message: string, isError?: boolean) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Wraps the app shell so any route can pop a bottom-of-screen confirmation
 *  via useToast() — Polaris' Toast only renders inside a Frame, so that
 *  lives here once instead of every page reaching for its own. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <Frame>
        {children}
        {toast ? (
          <Toast content={toast.message} error={toast.isError} duration={4000} onDismiss={() => setToast(null)} />
        ) : null}
      </Frame>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
