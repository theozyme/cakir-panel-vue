import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Car,
  Mail,
  Package,
  Speaker,
  Wrench,
  Wallet,
  BarChart3,
  Search,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Ana Sayfa", icon: LayoutDashboard },
  { to: "/araclar", label: "Araç İşlemleri", icon: Car },
  { to: "/mail-order", label: "Mail Order", icon: Mail },
  { to: "/stok", label: "Stok Yönetimi", icon: Package },
  { to: "/ses-sistemi", label: "Ses Sistemi", icon: Speaker },
  { to: "/servis", label: "Servis", icon: Wrench },
  { to: "/ozel-odemeler", label: "Özel Ödemeler", icon: Wallet },
  { to: "/raporlar", label: "Raporlar", icon: BarChart3 },
] as const;

export function AppLayout({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-30 bg-nav text-nav-foreground">
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 md:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground font-black">
              Ç
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold leading-tight">Çakır Oto</div>
              <div className="truncate text-[11px] text-white/60">Yönetim Paneli</div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative hidden xl:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input
                placeholder="Ara..."
                className="h-9 w-56 rounded-lg border border-white/15 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary"
              />
            </div>
            <button className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80 hover:text-white">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              ÇO
            </div>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Menü"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/5 text-white lg:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <nav className="hidden border-t border-white/10 lg:block">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-1 overflow-x-auto px-4 md:px-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                    isActive(item.to)
                      ? "border-primary text-white"
                      : "border-transparent text-white/70 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {open && (
          <nav className="border-t border-white/10 p-3 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.to)
                      ? "bg-primary text-primary-foreground"
                      : "text-white/75 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <div className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center px-4 py-4 md:px-6">
          <h1 className="text-lg font-bold text-foreground md:text-xl">{title ?? "Ana Sayfa"}</h1>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
