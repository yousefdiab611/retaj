import { Building2, LayoutGrid, LogOut, Moon, Package, Receipt, ShieldCheck, ShoppingCart, Sun, Users, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { clearSession, getSelectedBranchId, getUser, setSelectedBranchId } from "@/lib/api";
import { BRAND_LOGO_FALLBACK_SRC, BRAND_LOGO_PRIMARY_SRC } from "@/lib/branding";
import { useOnlineStatus } from "@/lib/offline/useOnlineStatus";
import { useOfflineSyncStatus } from "@/lib/offline/syncStatus";
import { isDesktopApp } from "@/lib/electron";
import { cn } from "@/lib/utils";

type MainNavProps = {
  endSlot?: ReactNode;
};

export function MainNav({ endSlot }: MainNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const online = useOnlineStatus();
  const [logoSrc, setLogoSrc] = useState(BRAND_LOGO_PRIMARY_SRC);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("retaj_theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const user = getUser();
  const [isDesktop, setIsDesktop] = useState(false);
  const { pendingSales, pendingCustomers, lastSyncAt } = useOfflineSyncStatus();
  const canManageProducts =
    user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "TENANT_ADMIN" || user?.role === "SUPER_ADMIN";
  const canManageBranches = user?.role === "ADMIN" || user?.role === "TENANT_ADMIN" || user?.role === "SUPER_ADMIN";
  const canManageTenants = user?.role === "SUPER_ADMIN";
  const canPickBranch =
    user?.role === "ADMIN" || user?.role === "MANAGER" || user?.role === "TENANT_ADMIN";

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("retaj_theme", theme);
  }, [theme]);

  useEffect(() => {
    setIsDesktop(isDesktopApp());
  }, []);

  function onLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  const linkCls = (path: string) =>
    cn(
      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      pathname === path
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-1 px-4 py-2.5">
        <Link
          to="/pos"
          className="me-3 flex min-w-0 items-center gap-3 text-sm font-semibold tracking-tight text-foreground"
        >
          <span className="flex h-9 w-[100px] shrink-0 items-center justify-center overflow-hidden">
            <img
              src={logoSrc}
              alt="Retaj Store logo"
              className="max-h-9 w-full object-contain object-left"
              decoding="async"
              fetchPriority="high"
              onError={() => setLogoSrc(BRAND_LOGO_FALLBACK_SRC)}
            />
          </span>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="block text-sm font-semibold">Retaj Store</span>
            <span className="block text-[11px] text-muted-foreground">ريتاج ستور</span>
          </div>
          <LayoutGrid className="h-4 w-4 shrink-0 text-primary sm:hidden" aria-hidden />
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          <Link to="/pos" className={linkCls("/pos")}>
            <ShoppingCart className="h-4 w-4 opacity-90" />
            POS
          </Link>
          <Link to="/reports" className={linkCls("/reports")}>
            <Receipt className="h-4 w-4 opacity-90" />
            Reports
          </Link>
          {isDesktop ? (
            <Link to="/license" className={linkCls("/license")}>
              <ShieldCheck className="h-4 w-4 opacity-90" />
              License
            </Link>
          ) : null}
          {canManageProducts ? (
            <Link to="/admin/products" className={linkCls("/admin/products")}>
              <Package className="h-4 w-4 opacity-90" />
              Catalog
            </Link>
          ) : null}
          {canManageBranches ? (
            <Link to="/admin/branches" className={linkCls("/admin/branches")}>
              <Building2 className="h-4 w-4 opacity-90" />
              Branches
            </Link>
          ) : null}
          {canManageTenants ? (
            <Link to="/admin/tenants" className={linkCls("/admin/tenants")}>
              <ShieldCheck className="h-4 w-4 opacity-90" />
              Tenants
            </Link>
          ) : null}
          {canManageBranches ? (
            <Link to="/admin/dashboard" className={linkCls("/admin/dashboard")}>
              <LayoutGrid className="h-4 w-4 opacity-90" />
              Dashboard
            </Link>
          ) : null}
          {canManageProducts ? (
            <Link to="/admin/customers" className={linkCls("/admin/customers")}>
              <Users className="h-4 w-4 opacity-90" />
              Customers
            </Link>
          ) : null}
          {canManageTenants ? (
            <Link to="/admin/logs" className={linkCls("/admin/logs")}>
              <ShieldCheck className="h-4 w-4 opacity-90" />
              Logs
            </Link>
          ) : null}
        </nav>

        {!online ? (
          <span
            className="inline-flex max-w-[min(100vw,220px)] items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-100"
            title="Sales are queued and will sync when connection returns"
          >
            <WifiOff className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">Offline mode active</span>
          </span>
        ) : null}
        {online && (pendingSales > 0 || pendingCustomers > 0) ? (
          <span
            className="inline-flex max-w-[min(100vw,220px)] items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-950 dark:text-blue-100"
            title={`Pending sync: ${pendingSales} sales, ${pendingCustomers} customers`}
          >
            <span className="text-xs">Sync queue:</span>
            <strong>{pendingSales + pendingCustomers}</strong>
          </span>
        ) : null}
        {online && lastSyncAt ? (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-muted/40 bg-muted/10 px-2 py-1 text-[10px] text-muted-foreground">
            <span>Last sync</span>
            <time dateTime={new Date(lastSyncAt).toISOString()}>
              {new Intl.DateTimeFormat(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(lastSyncAt))}
            </time>
          </span>
        ) : null}

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {canPickBranch && user && user.branches.length > 0 ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Branch</span>
              <select
                className="h-8 max-w-[160px] rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
                value={getSelectedBranchId() ?? user.branches[0]?.id ?? ""}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  window.location.reload();
                }}
              >
                {user.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : user?.role === "CASHIER" && user.branchId ? (
            <span className="max-w-[140px] truncate text-xs font-medium text-muted-foreground sm:max-w-[200px]">
              {user.branches.find((x) => x.id === user.branchId)?.name ?? "Branch"}
            </span>
          ) : null}
          {user ? (
            <div className="hidden max-w-[min(100vw,320px)] flex-col items-end gap-0.5 text-xs md:flex">
              <span className="truncate text-foreground">
                Welcome, <strong>{user.username ?? user.name}</strong>
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    user.role === "ADMIN" && "border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100",
                    user.role === "MANAGER" && "border-blue-500/60 bg-blue-500/10 text-blue-900 dark:text-blue-100",
                    user.role === "CASHIER" && "border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
                  )}
                >
                  {user.role}
                </span>
              </div>
            </div>
          ) : null}
          {endSlot}
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
