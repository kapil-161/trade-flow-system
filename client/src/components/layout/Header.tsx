import { cn } from "@/lib/utils";
import { LayoutDashboard, LineChart, PieChart, History, Settings, Bell, Activity, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { usePortfolioStats } from "@/lib/api";
import { Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: LineChart, label: "Scanner", href: "/market" },
  { icon: PieChart, label: "Portfolio", href: "/portfolio" },
  { icon: History, label: "History", href: "/history" },
  { icon: Zap, label: "Backtest", href: "/backtest" },
  { icon: Bell, label: "Alerts", href: "/alerts" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Header() {
  const [location] = useLocation();
  const { data: stats } = usePortfolioStats();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-card/80 backdrop-blur-xl">
      <div className="flex h-14 items-center px-4 lg:px-6">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2 mr-6 cursor-pointer">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:inline">
              NEXUS<span className="text-primary">TMS</span>
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 flex-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer group",
                  location === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <item.icon className={cn("h-4 w-4", location === item.href ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="hidden md:inline">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        {/* Portfolio Stats */}
        {stats && (
          <div className="hidden lg:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-lg bg-background/50 border border-border/50">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Portfolio</p>
              <p className="text-sm font-bold font-mono-nums">
                ${stats.totalEquity?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
              </p>
            </div>
            {stats.totalPnLPercent !== 0 && (
              <div className={cn(
                "text-xs font-bold",
                stats.totalPnLPercent >= 0 ? "text-profit" : "text-loss"
              )}>
                {stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(1)}%
              </div>
            )}
          </div>
        )}

        {/* User & Logout */}
        <div className="flex items-center gap-2 ml-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-muted-foreground">Logged in as</p>
            <p className="text-sm font-medium">{user?.username}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
