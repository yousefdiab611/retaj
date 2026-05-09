import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken, loginRequest, setUser } from "@/lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("eman");
  const [password, setPassword] = useState("eman123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDesktopActivationLink, setShowDesktopActivationLink] = useState(false);

  useEffect(() => {
    setShowDesktopActivationLink(typeof window !== "undefined" && Boolean(window.electronAPI));
  }, []);

  if (getToken()) {
    return <Navigate to="/pos" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await loginRequest(username.trim(), password);
      setUser(user);
      navigate("/pos", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      if (/server connection issue|failed to fetch|network error|network request failed/i.test(message)) {
        setError("الخادم غير متصل");
      } else if (/invalid username or password|INVALID_CREDENTIALS|Invalid username or password/i.test(message)) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      } else if (/not found/i.test(message)) {
        setError("Server connection issue");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-[400px] border-border/60 shadow-md">
        <CardHeader className="space-y-1 pb-2 text-center">
          <BrandLogo className="mb-2" />
          <CardTitle className="text-xl font-semibold tracking-tight">Retaj Store</CardTitle>
          <CardDescription className="text-sm">ريتاج ستور</CardDescription>
          <CardDescription className="text-sm">Log in to manage sales and inventory for your boutique.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error ? (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
          {showDesktopActivationLink ? (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <Link to="/license" className="text-primary underline">
                Activate desktop license
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
