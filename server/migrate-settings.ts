import { pool } from "./db";

export async function migrateSettingsTable() {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    console.log("Starting settings table migration...");
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'settings'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log("Creating settings table...");
      await client.query(`
        CREATE TABLE settings (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);
      console.log("✓ Settings table created");
    } else {
      console.log("✓ Settings table already exists");
    }
    
    await client.query("COMMIT");
    console.log("✓ Migration completed successfully");
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("✗ Migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateSettingsTable()
    .then(() => {
      console.log("Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
