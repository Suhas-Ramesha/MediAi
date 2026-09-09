import { useEffect } from "react";
import { useLocation } from "wouter";

import {
  AuthContext,
  AuthProvider,
  useAuth,
} from "@/contexts/AuthContext";

export { AuthContext, AuthProvider, useAuth };

/** Redirects unauthenticated visitors to the landing page. */
export function useRequireAuth() {
  const auth = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!auth.isLoading && !auth.currentUser) {
      setLocation("/");
    }
  }, [auth.isLoading, auth.currentUser, setLocation]);

  return auth;
} 