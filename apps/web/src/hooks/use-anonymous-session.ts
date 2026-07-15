"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase";

export function useAnonymousSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    async function connect() {
      try {
        const supabase = getSupabaseClient();
        const listener = supabase.auth.onAuthStateChange(
          (_event, nextSession) => {
            if (active) setSession(nextSession);
          },
        );
        unsubscribe = () => listener.data.subscription.unsubscribe();
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        let nextSession = data.session;
        if (!nextSession) {
          const signedIn = await supabase.auth.signInAnonymously();
          if (signedIn.error) throw signedIn.error;
          nextSession = signedIn.data.session;
        }
        if (active) setSession(nextSession);
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "匿名会话连接失败",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void connect();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { session, loading, error };
}
