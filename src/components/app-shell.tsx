import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Users, Settings, Scissors, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  hideNav?: boolean;
  backTo?: string;
  headerRight?: ReactNode;
  onBack?: () => void;
}

const navItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children, title, showBack, hideNav, backTo, headerRight, onBack }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const isNavActive = (to: string) => {
    if (to === "/home") return pathname === "/home";
    if (to === "/clients") return pathname === "/clients" || pathname.startsWith("/clients/");
    return pathname === to;
  };

  const handleBack = () => {
    if (onBack) return onBack();
    if (backTo) navigate({ to: backTo });
    else window.history.back();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Desktop sidebar */}
      {!hideNav && (
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card">
          <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shrink-0">
              <Scissors className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-lg leading-none">DarziYaar</div>
              <div className="text-xs text-muted-foreground mt-1">Job cards</div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition",
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 h-14 px-4 sm:px-6">
            {showBack ? (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back"
                className="grid h-10 w-10 -ml-2 place-items-center rounded-lg hover:bg-accent"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <div className="lg:hidden grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Scissors className="h-4 w-4" />
              </div>
            )}
            <h1 className="flex-1 font-semibold text-base sm:text-lg truncate">
              {title ?? "DarziYaar"}
            </h1>
            {headerRight}
          </div>
        </header>

        <main className={cn("flex-1", !hideNav && "pb-24 lg:pb-6")}>
          {children}
        </main>

        {/* Mobile bottom nav */}
        {!hideNav && (
          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
            <div className="grid grid-cols-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
