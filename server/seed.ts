import { db } from "./db";
import { holdings, trades } from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Add sample holdings
    const sampleHoldings = [
      {
        symbol: "BTC-USD",
        name: "Bitcoin",
        type: "crypto",
        quantity: "0.5",
        avgPrice: "45000.00",
      },
      {
        symbol: "ETH-USD",
        name: "Ethereum",
        type: "crypto",
        quantity: "5.0",
        avgPrice: "2800.00",
      },
      {
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        type: "stock",
        quantity: "25",
        avgPrice: "450.00",
      },
      {
        symbol: "TSLA",
        name: "Tesla Inc",
        type: "stock",
        quantity: "10",
        avgPrice: "180.00",
      },
    ];

    for (const holding of sampleHoldings) {
      await db.insert(holdings).values(holding);
    }

    // Add sample trades
    const sampleTrades = [
      {
        symbol: "BTC-USD",
        side: "buy",
        quantity: "0.5",
        price: "45000.00",
        totalValue: "22500.00",
        fees: "0.00",
        status: "filled",
      },
      {
        symbol: "ETH-USD",
        side: "buy",
        quantity: "5.0",
        price: "2800.00",
        totalValue: "14000.00",
        fees: "0.00",
        status: "filled",
      },
      {
        symbol: "NVDA",
        side: "buy",
        quantity: "25",
        price: "450.00",
        totalValue: "11250.00",
        fees: "0.00",
        status: "filled",
      },
      {
        symbol: "TSLA",
        side: "buy",
        quantity: "10",
        price: "180.00",
        totalValue: "1800.00",
        fees: "0.00",
        status: "filled",
      },
    ];

    for (const trade of sampleTrades) {
      await db.insert(trades).values(trade);
    }

    console.log("✅ Database seeded successfully!");
    console.log(`   - Added ${sampleHoldings.length} holdings`);
    console.log(`   - Added ${sampleTrades.length} trades`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }

  process.exit(0);
}

seed();
