import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";

export default function AppLayout({
  title,
  children,
  rightSlot,
}: {
  title?: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  const { session, profile } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to="/" className="truncate text-sm font-semibold tracking-tight">
                Visibilidade Logística
              </Link>
            </div>
            {title ? <div className="truncate text-xs text-muted-foreground">{title}</div> : null}
          </div>

          <div className="flex items-center gap-2">
            {rightSlot}

            {!session ? (
              <Button asChild size="sm" variant="secondary">
                <Link to="/login">Entrar</Link>
              </Button>
            ) : (
              <div className="hidden text-xs text-muted-foreground sm:block">
                {profile?.role ? `Perfil: ${profile.role}` : "Sessão ativa"}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}