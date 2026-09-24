"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "./api";
import { User } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ role: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    const refreshToken = localStorage.getItem("refresh_token");

    if (!token && !refreshToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // 1. Try existing access token
    if (token) {
      try {
        const data = await fetchApi<User>("/api/auth/me", { token });
        setUser(data);
        setIsLoading(false);
        return;
      } catch {
        // Access token expired or invalid, attempt token refresh next
      }
    }

    // 2. Try refresh token if available
    if (refreshToken) {
      try {
        const res = await fetchApi<{ access_token: string; refresh_token: string }>(
          "/api/auth/refresh",
          {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshToken }),
          }
        );
        localStorage.setItem("auth_token", res.access_token);
        localStorage.setItem("refresh_token", res.refresh_token);

        const data = await fetchApi<User>("/api/auth/me", { token: res.access_token });
        setUser(data);
        setIsLoading(false);
        return;
      } catch {
        // Refresh token also invalid or expired
      }
    }

    // 3. Clear invalid session silently
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string) => {
    const res = await fetchApi<{ access_token: string; refresh_token: string; role: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }
    );

    localStorage.setItem("auth_token", res.access_token);
    localStorage.setItem("refresh_token", res.refresh_token);

    // Fetch user details
    const userData = await fetchApi<User>("/api/auth/me", { token: res.access_token });
    setUser(userData);

    return { role: res.role };
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
