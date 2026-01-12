import { db } from "./db";
import { sql } from "drizzle-orm";

export async function migrateAlertsTables() {
  console.log("Running alerts tables migration...");

  try {
    // Create alerts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS alerts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        conditions TEXT NOT NULL,
        notify_email TEXT NOT NULL DEFAULT 'true',
        notify_browser TEXT NOT NULL DEFAULT 'true',
        last_checked TIMESTAMP,
        triggered_at TIMESTAMP,
        trigger_count DECIMAL(10, 0) NOT NULL DEFAULT '0',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✓ Alerts table created/verified");

    // Create alert_history table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS alert_history (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_id VARCHAR NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        price DECIMAL(18, 2),
        rsi DECIMAL(5, 2),
        ema_fast DECIMAL(18, 2),
        ema_slow DECIMAL(18, 2),
        volume DECIMAL(18, 2),
        conditions_met TEXT NOT NULL,
        triggered_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✓ Alert history table created/verified");

    // Create indexes for better query performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON alert_history(user_id)
    `);
    console.log("✓ Alert table indexes created");

    console.log("Alerts tables migration completed successfully");
  } catch (error) {
    console.error("Error during alerts tables migration:", error);
    throw error;
  }
}
