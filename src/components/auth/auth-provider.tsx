import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/lib/roles";
import { toast } from "@/components/ui/use-toast";

type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    setProfile((data as Profile) ?? null);
  };

  const refreshProfile = async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    await loadProfile(userId);
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;

      const nextSession = data.session ?? null;
      setSession(nextSession);

      if (nextSession?.user?.id) {
        try {
          await loadProfile(nextSession.user.id);
        } catch (e) {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);

      if (event === "SIGNED_IN") {
        const uid = nextSession?.user?.id;
        if (uid) {
          supabase
            .from("profiles")
            .select("id, role, full_name")
            .eq("id", uid)
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) throw error;
              setProfile((data as Profile) ?? null);
            })
            .catch(() => {
              setProfile(null);
              toast({
                title: "Não foi possível carregar seu perfil",
                description: "Tente novamente em instantes.",
                variant: "destructive",
              });
            });
        }

        navigate("/", { replace: true });
      }

      if (event === "SIGNED_OUT") {
        setProfile(null);
        navigate("/login", { replace: true });
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  const value = useMemo(
    () => ({ session, profile, isLoading, refreshProfile }),
    [session, profile, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}