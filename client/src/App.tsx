import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Portfolio from "@/pages/portfolio";
import History from "@/pages/history";
import Alerts from "@/pages/alerts";
import Backtest from "@/pages/backtest";
import BatchAnalysis from "@/pages/batch-analysis";
import RiskAnalytics from "@/pages/RiskAnalytics";
import MLPrediction from "@/pages/ml-prediction";
import Settings from "@/pages/settings";
import AdminPage from "@/pages/admin";
import SetupAdminPage from "@/pages/setup-admin";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route path="/forgot-password">
        {user ? <Redirect to="/" /> : <ForgotPasswordPage />}
      </Route>
      <Route path="/reset-password">
        {user ? <Redirect to="/" /> : <ResetPasswordPage />}
      </Route>
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/market">
        {() => <ProtectedRoute component={BatchAnalysis} />}
      </Route>
      <Route path="/portfolio">
        {() => <ProtectedRoute component={Portfolio} />}
      </Route>
      <Route path="/history">
        {() => <ProtectedRoute component={History} />}
      </Route>
      <Route path="/alerts">
        {() => <ProtectedRoute component={Alerts} />}
      </Route>
      <Route path="/backtest">
        {() => <ProtectedRoute component={Backtest} />}
      </Route>
      <Route path="/risk-analytics">
        {() => <ProtectedRoute component={RiskAnalytics} />}
      </Route>
      <Route path="/ml-prediction">
        {() => <ProtectedRoute component={MLPrediction} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPage} />}
      </Route>
      <Route path="/setup-admin">
        {() => <ProtectedRoute component={SetupAdminPage} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
