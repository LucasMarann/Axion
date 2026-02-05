import React, { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/auth/auth-provider";

type InternalRole = "driver" | "manager";

export default function OwnerUsers() {
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<InternalRole>("driver");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = useMemo(() => {
    return email.trim().length > 3 && password.length >= 6 && (role === "driver" || role === "manager");
  }, [email, password, role]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const token = sessionData.session?.access_token;
    if (!token) {
      toast({
        title: "Sessão expirada",
        description: "Faça login novamente.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const res = await fetch(
      "https://eniovljvaaycjepoykam.supabase.co/functions/v1/create-internal-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password,
          role,
          full_name: fullName.trim() ? fullName.trim() : null,
        }),
      }
    );

    const payload = await res.json();

    if (!res.ok) {
      toast({
        title: "Erro ao criar usuário",
        description: payload?.error ?? "Tente novamente.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: "Usuário criado",
      description: `Criado como ${role}.`,
    });

    setFullName("");
    setEmail("");
    setPassword("");
    setRole("driver");
    await refreshProfile();
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Criar usuário interno</CardTitle>
            <CardDescription>Apenas o Dono pode criar Motoristas e Operadores (manager).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Nome (opcional)</label>
                <input
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex.: João Motorista"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@empresa.com"
                  type="email"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Senha</label>
                <input
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  type="password"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Tipo</label>
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as InternalRole)}
                >
                  <option value="driver">Motorista</option>
                  <option value="manager">Operador (manager)</option>
                </select>
              </div>

              <Button type="submit" disabled={!isValid || isSubmitting}>
                {isSubmitting ? "Criando..." : "Criar usuário"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}