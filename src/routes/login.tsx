import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, LogIn, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Giriş · Çakır Oto" },
      { name: "description", content: "Çakır Oto yönetim paneli güvenli giriş ekranı." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
      await navigate({ to: "/", replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Giriş yapılamadı.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(234,179,8,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-lg shadow-primary/20">
            Ç
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">Çakır Oto</p>
            <p className="text-xs text-slate-400">Yönetim Paneli</p>
          </div>
        </div>

        <Card className="border-white/10 bg-white/[0.98] shadow-2xl shadow-black/30">
          <CardHeader className="space-y-3 pb-5 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Panele giriş yapın</CardTitle>
              <CardDescription className="mt-2">
                Devam etmek için kullanıcı bilgilerinizi girin.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Kullanıcı adı</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  required
                  maxLength={100}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Kullanıcı adınız"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Parola</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    maxLength={200}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Parolanız"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Parolayı gizle" : "Parolayı göster"}
                    className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !username.trim() || !password}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
                {isSubmitting ? "Giriş yapılıyor..." : "Giriş yap"}
              </Button>
            </form>

            <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/70 px-3 py-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Güvenli oturumunuz bu tarayıcıda 12 saat boyunca açık kalır.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
