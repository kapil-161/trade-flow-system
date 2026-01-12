import { pool } from "./db";

export async function migrateResetTokenColumns() {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    console.log("Starting reset token migration...");
    
    // Check if columns already exist
    const resetTokenCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'reset_token'
    `);
    
    const resetTokenExpiryCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'reset_token_expiry'
    `);
    
    // Add reset_token column if it doesn't exist
    if (resetTokenCheck.rows.length === 0) {
      console.log("Adding reset_token column to users...");
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN reset_token TEXT
      `);
      console.log("✓ Reset token column added");
    } else {
      console.log("✓ Reset token column already exists");
    }
    
    // Add reset_token_expiry column if it doesn't exist
    if (resetTokenExpiryCheck.rows.length === 0) {
      console.log("Adding reset_token_expiry column to users...");
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN reset_token_expiry TIMESTAMP
      `);
      console.log("✓ Reset token expiry column added");
    } else {
      console.log("✓ Reset token expiry column already exists");
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
  migrateResetTokenColumns()
    .then(() => {
      console.log("Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
