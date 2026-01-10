export const MARKET_SECTORS = {
  TECH: ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AVGO", "ORCL", "CRM"],
  FINANCE: ["JPM", "BAC", "WFC", "GS", "MS", "V", "MA", "PYPL"],
  CRYPTO: ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "ADA-USD", "XRP-USD"],
  ENERGY: ["XOM", "CVX", "SHEL", "BP", "TTE", "COP"],
  HEALTHCARE: ["LLY", "UNH", "JNJ", "ABBV", "MRK", "PFE"],
  CONSUMER: ["AMZN", "WMT", "COST", "HD", "PG", "KO", "PEP"],
  INDICES: ["^GSPC", "^NDX", "^DJI", "^RUT"]
};

export const ALL_SYMBOLS = Object.values(MARKET_SECTORS).flat();

export const POPULAR_SYMBOLS = [
  { label: "Bitcoin", value: "BTC-USD" },
  { label: "Ethereum", value: "ETH-USD" },
  { label: "Apple", value: "AAPL" },
  { label: "Microsoft", value: "MSFT" },
  { label: "NVIDIA", value: "NVDA" },
  { label: "Tesla", value: "TSLA" },
  { label: "Amazon", value: "AMZN" },
  { label: "Google", value: "GOOGL" },
  { label: "Meta", value: "META" },
  { label: "JPMorgan", value: "JPM" },
  { label: "Visa", value: "V" },
  { label: "ExxonMobil", value: "XOM" },
  { label: "UnitedHealth", value: "UNH" },
  { label: "Eli Lilly", value: "LLY" },
  { label: "Walmart", value: "WMT" },
  { label: "S&P 500", value: "^GSPC" },
  { label: "Nasdaq 100", value: "^NDX" },
];
