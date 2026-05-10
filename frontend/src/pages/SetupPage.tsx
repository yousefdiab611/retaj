import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runInitialSetup } from "@/lib/api";

export function SetupPage() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [branchName, setBranchName] = useState("الفرع الرئيسي");
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (adminPassword.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف أو أكثر.");
      return;
    }
    if (adminPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    const usernameOk = /^[a-zA-Z0-9._-]+$/.test(adminUsername);
    if (!usernameOk) {
      setError("اسم المستخدم: أحرف لاتينية وأرقام و . _ - فقط.");
      return;
    }

    setLoading(true);
    try {
      await runInitialSetup({
        businessName: businessName.trim(),
        branchName: branchName.trim() || "Main",
        adminName: adminName.trim(),
        adminUsername: adminUsername.trim(),
        adminPassword,
      });
      navigate("/login", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذّر إكمال الإعداد";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo />
          </div>
          <CardTitle className="text-2xl">مرحباً بك في ريتاج ستور</CardTitle>
          <CardDescription>أعِدَّ متجرك للمرة الأولى بإنشاء حساب المسؤول وفرعك الرئيسي.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="businessName">اسم المتجر</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="مثال: متجر النور"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branchName">اسم الفرع</Label>
              <Input
                id="branchName"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminName">اسم المسؤول</Label>
              <Input
                id="adminName"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="مثال: يوسف ضياء"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminUsername">اسم المستخدم (للدخول)</Label>
              <Input
                id="adminUsername"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminPassword">كلمة المرور</Label>
              <Input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div
                className="sm:col-span-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="sm:col-span-2 flex justify-end pt-2">
              <Button type="submit" disabled={loading} className="min-w-40">
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإعداد…
                  </>
                ) : (
                  "بدء استخدام البرنامج"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
