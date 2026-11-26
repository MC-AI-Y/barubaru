"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authApi, type SessionInfo } from "./api";
import { PREVIOUS_SCREEN, screenIndex, type ScreenId } from "./steps";

/**
 * Status sesi di browser hanya cermin dari cookie httpOnly di server.
 * Sumber kebenarannya tetap server (diverifikasi di setiap API).
 */
export type Session = SessionInfo;

export type Direction = "forward" | "back";

interface FlowApi {
  screen: ScreenId;
  direction: Direction;
  session: Session | null;
  /** true selama aplikasi memeriksa sesi tersimpan saat pertama dibuka. */
  booting: boolean;
  go: (to: ScreenId) => void;
  back: () => void;
  signIn: (session: Session) => void;
  /** Mengembalikan pesan galat bila gagal, atau null bila berhasil. */
  signOut: () => Promise<string | null>;
  /** Dipanggil saat API membalas 401: sesi lokal dihapus, kembali ke Beranda (draf tetap aman). */
  expireSession: () => void;
}

const FlowContext = createContext<FlowApi | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [direction, setDirection] = useState<Direction>("forward");
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  // Pulihkan sesi dari cookie saat aplikasi dibuka ulang.
  useEffect(() => {
    let active = true;
    authApi.session().then((res) => {
      if (!active) return;
      if (res.ok) setSession({ subcontName: res.data.subcontName, role: res.data.role === "admin" ? "admin" : "subcont" });
      setBooting(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Riwayat layar agar "Kembali" kembali ke layar sebelumnya yang benar-benar dibuka
  // (mis. Review → Data Gudang → Kembali = Review).
  const history = useRef<ScreenId[]>([]);

  const go = useCallback(
    (to: ScreenId) => {
      if (to === screen) return;
      if (to === "home" || to === "visit" || to === "done" || to === "submit") history.current = [];
      else history.current.push(screen);
      setDirection(screenIndex(to) > screenIndex(screen) ? "forward" : "back");
      setScreen(to);
    },
    [screen],
  );

  const back = useCallback(() => {
    if (!PREVIOUS_SCREEN[screen]) return;
    let prev = history.current.pop();
    while (prev === screen) prev = history.current.pop();
    const target = prev && prev !== "submit" && prev !== "done" ? prev : PREVIOUS_SCREEN[screen];
    if (!target) return;
    setDirection("back");
    setScreen(target);
  }, [screen]);

  const signIn = useCallback((s: Session) => {
    history.current = [];
    setSession(s);
    setDirection("back");
    setScreen("home");
  }, []);

  const signOut = useCallback(async () => {
    const res = await authApi.logout();
    if (!res.ok) return res.message;
    setSession(null);
    setDirection("back");
    setScreen("home");
    return null;
  }, []);

  const expireSession = useCallback(() => {
    setSession(null);
    setDirection("back");
    setScreen("home");
  }, []);

  const api = useMemo<FlowApi>(
    () => ({ screen, direction, session, booting, go, back, signIn, signOut, expireSession }),
    [screen, direction, session, booting, go, back, signIn, signOut, expireSession],
  );

  return <FlowContext.Provider value={api}>{children}</FlowContext.Provider>;
}

export function useFlow(): FlowApi {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow harus dipakai di dalam <FlowProvider>.");
  return ctx;
}
