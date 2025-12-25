import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BacktestForm } from "@/components/dashboard/BacktestForm";
import { BacktestResults } from "@/components/dashboard/BacktestResults";
import type { BacktestResult } from "@shared/schema";

export default function Backtest() {
  const [result, setResult] = useState<BacktestResult | null>(null);

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 pb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Strategy Backtest</h1>
          <p className="text-muted-foreground">Test the Multi-Factor Weighted Momentum strategy on historical data.</p>
        </div>

        <BacktestForm onSuccess={setResult} />

        {result && <BacktestResults result={result} />}
      </div>
    </DashboardLayout>
  );
}
