import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function SetupAdminPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSetAdmin = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/setup/first-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: "kapil.bhattarai.161@gmail.com" }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, message: data.message });
        toast({
          title: "Success!",
          description: data.message,
        });
        // Refresh user data to get updated admin status
        await refreshUser();
        // Redirect to admin page after a short delay
        setTimeout(() => {
          setLocation("/admin");
        }, 2000);
      } else {
        setResult({ success: false, message: data.error || "Failed to set admin" });
        toast({
          title: "Error",
          description: data.error || "Failed to set admin",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || "Network error occurred" });
      toast({
        title: "Error",
        description: error.message || "Network error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Set First Administrator</CardTitle>
          <CardDescription>
            This will set <strong>kapil.bhattarai.161@gmail.com</strong> as the first administrator.
            <br />
            <em className="text-xs">Only works if no admins exist yet.</em>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Logged in as:</p>
              <p className="font-medium">{user.username}</p>
            </div>
          )}

          {!result && (
            <Button
              onClick={handleSetAdmin}
              disabled={isLoading || !user}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Set as Administrator
                </>
              )}
            </Button>
          )}

          {result && (
            <div
              className={`p-4 rounded-lg flex items-start gap-3 ${
                result.success
                  ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    result.success
                      ? "text-green-900 dark:text-green-100"
                      : "text-red-900 dark:text-red-100"
                  }`}
                >
                  {result.success ? "Success!" : "Error"}
                </p>
                <p
                  className={`text-sm mt-1 ${
                    result.success
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {result.message}
                </p>
                {result.success && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    Redirecting to admin panel...
                  </p>
                )}
              </div>
            </div>
          )}

          {!user && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                Please log in first to set administrator status.
              </p>
              <Button
                onClick={() => setLocation("/login")}
                variant="outline"
                className="w-full mt-2"
              >
                Go to Login
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <Button
              onClick={() => setLocation("/")}
              variant="ghost"
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
