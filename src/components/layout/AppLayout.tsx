import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
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

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-nav text-nav-foreground lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-black">
            Ç
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight">Çakır Oto</div>
            <div className="text-[11px] text-white/60">Yönetim Paneli</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-white/75 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-[11px] text-white/50">
          v1.0 · Faz 1 UI
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-card/80 px-4 backdrop-blur md:px-6">
          <h1 className="text-lg font-bold text-foreground md:text-xl">
            {title ?? "Ana Sayfa"}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Ara..."
                className="h-9 w-64 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-input bg-background text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              ÇO
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
