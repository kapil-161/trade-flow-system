import { cn } from "@/lib/utils";
import { LayoutDashboard, LineChart, PieChart, History, Settings, Bell, LogOut, Menu, Activity, ArrowUpRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: LineChart, label: "Market", href: "/market" },
  { icon: PieChart, label: "Portfolio", href: "/portfolio" },
  { icon: History, label: "History", href: "/history" },
  { icon: Bell, label: "Alerts", href: "/alerts" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const [location] = useLocation();

  const NavContent = () => (
    <div className="flex flex-col h-full py-4">
      <div className="px-6 mb-8 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary flex items-center justify-center">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <span className="font-bold text-xl tracking-tight">NEXUS<span className="text-primary">TMS</span></span>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                location === item.href
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.2)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <item.icon className={cn("h-5 w-5", location === item.href ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {item.label}
            </div>
          </Link>
        ))}
      </nav>

      <div className="px-4 mt-auto">
        <div className="p-4 rounded-xl bg-card border border-border/50 mb-4">
          <p className="text-xs text-muted-foreground mb-2">Total Equity</p>
          <p className="text-lg font-bold font-mono-nums tracking-tight">$125,840.50</p>
          <div className="flex items-center gap-1 text-xs text-profit mt-1">
            <ArrowUpRight className="h-3 w-3" />
            <span>+1.2%</span>
          </div>
        </div>
        
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <LogOut className="h-5 w-5" />
          Log Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 border-r border-border/40 bg-sidebar/50 backdrop-blur-xl fixed inset-y-0 z-50">
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden fixed top-4 left-4 z-50">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 border-r border-border/40 bg-sidebar">
          <NavContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
