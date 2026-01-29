"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";

export type User = { id: number; username: string; email: string };

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (access: string, user: User, refresh?: string) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback((access: string, u: User, _refresh?: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(AUTH_TOKEN_KEY, access);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(u));
    setToken(access);
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (typeof window !== "undefined" && u)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(u));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored);
    const storedUser = localStorage.getItem(AUTH_USER_KEY);
    if (storedUser) {
      try {
        setUserState(JSON.parse(storedUser));
      } catch {
        // ignore
      }
    }
    setLoading(false);
  }, []);

  const value: AuthContextValue = {
    token,
    user,
    loading,
    login,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}
