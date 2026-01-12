import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, TrendingUp, History, Star, Loader2, Mail, Settings as SettingsIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

interface AdminStats {
  users: {
    total: number;
    admins: number;
  };
  holdings: {
    total: number;
    uniqueSymbols: number;
  };
  trades: {
    total: number;
    filled: number;
  };
  watchlist: {
    total: number;
  };
}

export default function AdminPage() {
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Refresh user data on mount to ensure we have latest admin status
  useEffect(() => {
    if (!authLoading && user) {
      refreshUser();
    }
  }, []);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirect if not logged in
  if (!user) {
    setLocation("/login");
    return null;
  }

  // Show access denied message if not admin
  if (!user.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need administrator privileges to access this page.
              {user.username && (
                <span className="block mt-2 text-sm">
                  Logged in as: <strong>{user.username}</strong>
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => refreshUser()} variant="outline" className="w-full">
              Refresh Status
            </Button>
            <Button onClick={() => setLocation("/")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: users, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const updateUserAdmin = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isAdmin }),
      });
      if (!response.ok) throw new Error("Failed to update user");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({
        title: "Success",
        description: "User admin status updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">Manage users and view system statistics</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.users.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.users.admins || 0} administrators
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Holdings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.holdings.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.holdings.uniqueSymbols || 0} unique symbols
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trades</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.trades.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.trades.filled || 0} filled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Watchlist</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.watchlist.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">Tracked assets</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different admin sections */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="smtp">SMTP Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage user permissions and roles</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Admin Access</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((adminUser) => (
                      <TableRow key={adminUser.id}>
                        <TableCell className="font-medium">{adminUser.username}</TableCell>
                        <TableCell>
                          <Badge variant={adminUser.isAdmin ? "default" : "secondary"}>
                            {adminUser.isAdmin ? "Admin" : "User"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={adminUser.isAdmin}
                              onCheckedChange={(checked) =>
                                updateUserAdmin.mutate({ userId: adminUser.id, isAdmin: checked })
                              }
                              disabled={updateUserAdmin.isPending || adminUser.id === user?.id}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp" className="space-y-4">
          <SMTPConfigSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SMTPConfigSection() {
  const { toast } = useToast();
  const [smtpSettings, setSmtpSettings] = useState({
    host: "",
    port: "587",
    secure: false,
    user: "",
    password: "",
  });
  const [testEmail, setTestEmail] = useState("");

  const { data: currentSettings, isLoading: settingsLoading, refetch } = useQuery({
    queryKey: ["smtp-settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/smtp-settings", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch SMTP settings");
      return response.json();
    },
  });

  useEffect(() => {
    if (currentSettings) {
      setSmtpSettings({
        host: currentSettings.host || "",
        port: currentSettings.port || "587",
        secure: currentSettings.secure || false,
        user: currentSettings.user || "",
        password: "", // Never show actual password
      });
      setTestEmail(currentSettings.user || "");
    }
  }, [currentSettings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      // If password is empty but settings are already configured, use a placeholder
      // The backend will keep the existing password if we send empty string
      const settingsToSave = {
        ...smtpSettings,
        // Only send password if it's been entered (not empty)
        // If empty and already configured, backend should keep existing password
        password: smtpSettings.password || (currentSettings?.configured ? "KEEP_EXISTING" : ""),
      };
      
      const response = await fetch("/api/admin/smtp-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settingsToSave),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save SMTP settings");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "SMTP settings saved successfully",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save SMTP settings",
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      
      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        // Check if response is JSON
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          throw new Error(data.error || `Failed to send test email (${response.status})`);
        } else {
          // Response is HTML (error page)
          const text = await response.text();
          throw new Error(`Server error (${response.status}): ${response.statusText}. Please check server logs.`);
        }
      }
      
      // Check if response is JSON before parsing
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      } else {
        throw new Error("Server returned unexpected response format");
      }
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: `Test email sent successfully to ${testEmail}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  if (settingsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          SMTP Configuration
        </CardTitle>
        <CardDescription>
          Configure SMTP settings for password reset emails. Settings are stored in the database and take precedence over environment variables.
          <br />
          <span className="text-xs text-muted-foreground mt-1 block">
            💡 <strong>Gmail users:</strong> Enable 2-Step Verification and create an App Password at{" "}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              myaccount.google.com/apppasswords
            </a>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status indicator */}
        {currentSettings?.configured && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-500">SMTP is configured and ready to use</span>
          </div>
        )}
        {!currentSettings?.configured && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <span className="text-sm text-yellow-500">SMTP is not configured. Password reset emails will not be sent.</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="smtp-host">SMTP Host</Label>
            <Input
              id="smtp-host"
              placeholder="smtp.gmail.com"
              value={smtpSettings.host}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
              disabled={saveSettings.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-port">SMTP Port</Label>
            <Input
              id="smtp-port"
              type="number"
              placeholder="587"
              value={smtpSettings.port}
              onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
              disabled={saveSettings.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-user">SMTP Username/Email</Label>
            <Input
              id="smtp-user"
              type="email"
              placeholder="your-email@gmail.com"
              value={smtpSettings.user}
              onChange={(e) => {
                setSmtpSettings({ ...smtpSettings, user: e.target.value });
                setTestEmail(e.target.value);
              }}
              disabled={saveSettings.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-password">SMTP Password</Label>
            <Input
              id="smtp-password"
              type="password"
              placeholder="Enter SMTP password or app password"
              value={smtpSettings.password}
              onChange={(e) => {
                // Remove spaces from Gmail app passwords automatically
                const cleanedPassword = e.target.value.replace(/\s/g, '');
                setSmtpSettings({ ...smtpSettings, password: cleanedPassword });
              }}
              disabled={saveSettings.isPending}
            />
            <p className="text-xs text-muted-foreground">
              For Gmail, use an App Password (not your regular password). Spaces will be automatically removed.
            </p>
            {smtpSettings.password && smtpSettings.password.length < 8 && (
              <p className="text-xs text-yellow-500">
                ⚠️ Password seems too short. Gmail app passwords are 16 characters.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="smtp-secure"
            checked={smtpSettings.secure}
            onCheckedChange={(checked) => setSmtpSettings({ ...smtpSettings, secure: checked })}
            disabled={saveSettings.isPending}
          />
          <Label htmlFor="smtp-secure" className="cursor-pointer">
            Use SSL (port 465) instead of TLS (port 587)
          </Label>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => saveSettings.mutate()}
            disabled={
              saveSettings.isPending || 
              !smtpSettings.host?.trim() || 
              !smtpSettings.user?.trim() || 
              (!smtpSettings.password?.trim() && !currentSettings?.configured)
            }
            title={
              !smtpSettings.host?.trim()
                ? "SMTP Host is required"
                : !smtpSettings.user?.trim()
                ? "SMTP Username/Email is required"
                : !smtpSettings.password?.trim() && !currentSettings?.configured
                ? "Password is required for new SMTP configuration"
                : undefined
            }
          >
            {saveSettings.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <SettingsIcon className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => testEmailMutation.mutate(testEmail)}
            disabled={testEmailMutation.isPending || !testEmail || !currentSettings?.configured}
          >
            {testEmailMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Test Email
              </>
            )}
          </Button>
        </div>

        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2 text-sm">Common SMTP Providers:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li><strong>Gmail:</strong> smtp.gmail.com, Port 587 (TLS) or 465 (SSL), Use App Password</li>
            <li><strong>Outlook:</strong> smtp.office365.com, Port 587 (TLS)</li>
            <li><strong>SendGrid:</strong> smtp.sendgrid.net, Port 587 (TLS), Username: apikey</li>
            <li><strong>Mailgun:</strong> smtp.mailgun.org, Port 587 (TLS)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
