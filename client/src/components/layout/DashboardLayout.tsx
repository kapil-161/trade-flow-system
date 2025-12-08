import { Sidebar } from "./Sidebar";
import bgImage from "@assets/generated_images/subtle_dark_abstract_digital_mesh_background_for_fintech_app.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 selection:text-primary-foreground overflow-x-hidden">
      {/* Background Image Layer */}
      <div 
        className="fixed inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Gradient Overlay for Depth */}
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-background via-background/95 to-background/80 pointer-events-none" />

      <Sidebar />
      
      <main className="relative z-10 lg:pl-64 min-h-screen flex flex-col transition-all duration-300">
        <div className="flex-1 p-4 lg:p-8 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
