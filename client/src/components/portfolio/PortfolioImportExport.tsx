import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Download, Upload, FileJson, FileSpreadsheet, Loader2, ClipboardPaste } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function ExportDialog() {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/portfolio/export?format=${format}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `Portfolio exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export portfolio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-card/50 backdrop-blur border-border/50 hover:bg-card/80">
          <Download className="mr-2 h-4 w-4" />
          Export Portfolio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Portfolio</DialogTitle>
          <DialogDescription>
            Download your portfolio data in CSV or JSON format.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as "csv" | "json")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV (Holdings only)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer">
                  <FileJson className="h-4 w-4" />
                  JSON (Holdings + Trades)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Parse custom paste format
function parseCustomFormat(text: string): any[] {
  const lines = text.trim().split('\n');
  const holdings: any[] = [];

  for (let i = 0; i < lines.length; i += 4) {
    if (i + 3 >= lines.length) break;

    const symbol = lines[i].trim();
    const quantityLine = lines[i + 1].trim();
    const pnlLine = lines[i + 2].trim();

    // Parse quantity (e.g., "1 share" or "2 shares" or "0.309326 shares")
    const quantityMatch = quantityLine.match(/([\d.]+)\s+shares?/i);
    if (!quantityMatch) continue;
    const quantity = parseFloat(quantityMatch[1]);

    // Parse PnL (e.g., "+$34.00" or "-$8.55")
    const pnlMatch = pnlLine.match(/([+-])\$?([\d.]+)/);
    if (!pnlMatch) continue;
    const pnlAmount = parseFloat(pnlMatch[2]);
    const pnlSign = pnlMatch[1];

    // Parse percentage (e.g., "+136.00%" or "-21.38%")
    const percentLine = lines[i + 3].trim();
    const percentMatch = percentLine.match(/([+-])([\d.]+)%/);
    if (!percentMatch) continue;
    const pnlPercent = parseFloat(percentMatch[2]) * (percentMatch[1] === '-' ? -1 : 1);

    // Calculate average price from PnL percentage
    // PnL% = (currentPrice - avgPrice) / avgPrice * 100
    // avgPrice = currentPrice / (1 + PnL%/100)
    // We need to estimate current price from quantity and PnL amount
    // currentPrice * quantity = avgPrice * quantity + pnlAmount
    // currentPrice = avgPrice * (1 + pnlPercent/100)
    // So: avgPrice = pnlAmount / (quantity * pnlPercent/100)
    const avgPrice = Math.abs(pnlAmount) / (quantity * Math.abs(pnlPercent) / 100);

    holdings.push({
      symbol,
      name: symbol,
      type: 'stock',
      quantity: quantity.toString(),
      avgPrice: avgPrice.toFixed(2),
    });
  }

  return holdings;
}

export function ImportDialog() {
  const [importMethod, setImportMethod] = useState<"file" | "paste">("paste");
  const [format, setFormat] = useState<"csv" | "json">("json");
  const [pasteText, setPasteText] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (data: { data: string; format: string; replaceExisting: boolean }) => {
      const response = await fetch("/api/portfolio/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/stats"] });

      toast({
        title: "Import successful",
        description: `Imported ${result.imported.holdings} holdings and ${result.imported.trades} trades`,
      });
      setOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      importMutation.mutate({
        data: text,
        format,
        replaceExisting,
      });
    } catch (error) {
      toast({
        title: "File read error",
        description: "Failed to read the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePasteImport = () => {
    if (!pasteText.trim()) {
      toast({
        title: "No data",
        description: "Please paste your portfolio data first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Parse the custom format
      const holdings = parseCustomFormat(pasteText);

      if (holdings.length === 0) {
        toast({
          title: "Parse error",
          description: "Could not parse the pasted data. Please check the format.",
          variant: "destructive",
        });
        return;
      }

      // Convert to JSON format for import
      const importData = {
        holdings,
        trades: [],
      };

      importMutation.mutate({
        data: JSON.stringify(importData),
        format: "json",
        replaceExisting,
      });
    } catch (error) {
      toast({
        title: "Import error",
        description: "Failed to parse pasted data. Please check the format.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-card/50 backdrop-blur border-border/50 hover:bg-card/80">
          <Upload className="mr-2 h-4 w-4" />
          Import Portfolio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Portfolio</DialogTitle>
          <DialogDescription>
            Paste your portfolio data or upload a CSV/JSON file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Import Method Selection */}
          <div className="space-y-2">
            <Label>Import Method</Label>
            <RadioGroup value={importMethod} onValueChange={(v) => setImportMethod(v as "file" | "paste")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="paste" id="method-paste" />
                <Label htmlFor="method-paste" className="flex items-center gap-2 cursor-pointer">
                  <ClipboardPaste className="h-4 w-4" />
                  Paste Text
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="file" id="method-file" />
                <Label htmlFor="method-file" className="flex items-center gap-2 cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Upload File
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Paste Import */}
          {importMethod === "paste" && (
            <div className="space-y-2">
              <Label htmlFor="paste-data">Paste Portfolio Data</Label>
              <Textarea
                id="paste-data"
                placeholder={`AAPL\n1 share\n+$34.00\n+136.00%\nMSFT\n0.5 shares\n-$8.55\n-21.38%`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                disabled={importMutation.isPending}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Format: Symbol, Quantity (e.g., "1 share"), P/L Amount (e.g., "+$34.00"), P/L Percentage (e.g., "+136.00%") - each on a new line
              </p>
            </div>
          )}

          {/* File Import */}
          {importMethod === "file" && (
            <>
              <div className="space-y-2">
                <Label>File Format</Label>
                <RadioGroup value={format} onValueChange={(v) => setFormat(v as "csv" | "json")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="csv" id="import-csv" />
                    <Label htmlFor="import-csv" className="flex items-center gap-2 cursor-pointer">
                      <FileSpreadsheet className="h-4 w-4" />
                      CSV (Holdings only)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="json" id="import-json" />
                    <Label htmlFor="import-json" className="flex items-center gap-2 cursor-pointer">
                      <FileJson className="h-4 w-4" />
                      JSON (Holdings + Trades)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Select File</Label>
                <input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept={format === "csv" ? ".csv" : ".json"}
                  onChange={handleFileChange}
                  disabled={importMutation.isPending}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </>
          )}

          {/* Replace Existing Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="replace"
              checked={replaceExisting}
              onCheckedChange={(checked) => setReplaceExisting(checked as boolean)}
            />
            <Label
              htmlFor="replace"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Replace existing portfolio
            </Label>
          </div>

          {/* Import Button */}
          {importMethod === "paste" && (
            <Button onClick={handlePasteImport} disabled={importMutation.isPending} className="w-full">
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <ClipboardPaste className="mr-2 h-4 w-4" />
                  Import from Paste
                </>
              )}
            </Button>
          )}

          {importMutation.isPending && importMethod === "file" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing portfolio...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
