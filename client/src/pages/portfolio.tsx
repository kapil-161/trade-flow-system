import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ActivePositions } from "@/components/dashboard/ActivePositions";
import { OrderDialog } from "@/components/dashboard/OrderDialog";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";

export default function Portfolio() {
  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 pb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
            <p className="text-muted-foreground">Manage your assets and track performance.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-card/50 backdrop-blur border-border/50 hover:bg-card/80">
              <Download className="mr-2 h-4 w-4" />
              Export Portfolio
            </Button>
            
            <OrderDialog>
              <Button className="shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)]">
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </OrderDialog>
          </div>
        </div>

        <ActivePositions />
      </div>
    </DashboardLayout>
  );
}
