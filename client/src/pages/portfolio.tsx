import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ActivePositions } from "@/components/dashboard/ActivePositions";
import { OrderDialog } from "@/components/dashboard/OrderDialog";
import { ExportDialog, ImportDialog } from "@/components/portfolio/PortfolioImportExport";
import { PortfolioAnalytics } from "@/components/portfolio/PortfolioAnalytics";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, BarChart3, Briefcase } from "lucide-react";

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
            <ImportDialog />
            <ExportDialog />

            <OrderDialog>
              <Button className="shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)]">
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </OrderDialog>
          </div>
        </div>

        <Tabs defaultValue="positions" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="positions" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Positions
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="mt-6">
            <ActivePositions />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <PortfolioAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
