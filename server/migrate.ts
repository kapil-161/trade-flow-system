import { pool } from "./db";

export async function ensureAdminColumn() {
  try {
    // Check if column exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_admin'
    `);
    
    if (checkResult.rows.length > 0) {
      return; // Column already exists
    }
    
    console.log("Adding is_admin column to users table...");
    
    // Add the column
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin TEXT DEFAULT 'false' NOT NULL
    `);
    
    // Update existing users to have is_admin = 'false' if null
    await pool.query(`
      UPDATE users 
      SET is_admin = 'false' 
      WHERE is_admin IS NULL
    `);
    
    console.log("✓ Successfully added is_admin column");
  } catch (error) {
    console.error("Failed to ensure admin column:", error);
    // Don't throw - allow server to start even if migration fails
    // The manual migration script can be run if needed
  }
}
