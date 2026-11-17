import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  user: { id: number; username: string; role: string };
  token: string;
  login: (user: AuthState["user"], token: string) => void;
  logout: () => void;
}

const DEFAULT_USER = { id: 1, username: "admin", role: "admin" };

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: DEFAULT_USER,
      token: "offline-active-session",
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: DEFAULT_USER, token: "offline-active-session" }),
    }),
    { name: "karate-auth" }
  )
);
