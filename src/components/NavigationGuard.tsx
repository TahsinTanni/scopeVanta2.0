"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

type Guard = (href: string) => void;
type NavigationGuardContextValue = {
  requestNavigation: (href: string) => void;
  setNavigationGuard: (fn: Guard | null) => void;
};

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

// Lets programmatic navigation (e.g. the command palette) respect a page's
// unsaved-edit guard. With no guard registered it is a plain router.push.
export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const guardRef = useRef<Guard | null>(null);

  const setNavigationGuard = useCallback((fn: Guard | null) => {
    guardRef.current = fn;
  }, []);

  const requestNavigation = useCallback(
    (href: string) => {
      if (guardRef.current) guardRef.current(href);
      else router.push(href);
    },
    [router]
  );

  const value = useMemo(() => ({ requestNavigation, setNavigationGuard }), [requestNavigation, setNavigationGuard]);

  return <NavigationGuardContext.Provider value={value}>{children}</NavigationGuardContext.Provider>;
}

export function useNavigationGuard(): NavigationGuardContextValue {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) throw new Error("useNavigationGuard must be used within a <NavigationGuardProvider>");
  return ctx;
}
