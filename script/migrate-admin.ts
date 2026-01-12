import "dotenv/config";
import { pool } from "../server/db";

async function migrateAdmin() {
  try {
    console.log("Checking if is_admin column exists...");
    
    // Check if column exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_admin'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log("✓ Column 'is_admin' already exists");
      return;
    }
    
    console.log("Adding is_admin column to users table...");
    
    // Add the column
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin TEXT DEFAULT 'false' NOT NULL
    `);
    
    console.log("✓ Successfully added is_admin column");
    
    // Update existing users to have is_admin = 'false' if null
    await pool.query(`
      UPDATE users 
      SET is_admin = 'false' 
      WHERE is_admin IS NULL
    `);
    
    console.log("✓ Updated existing users");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrateAdmin()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
