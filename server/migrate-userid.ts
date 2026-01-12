import { pool } from "./db";

/**
 * Migration script to add userId columns to holdings, trades, and watchlist tables
 * and assign existing data to the first admin user (or first user if no admin exists)
 */
export async function migrateUserIdColumns() {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    console.log("Starting userId migration...");
    
    // Check if columns already exist
    const holdingsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'holdings' AND column_name = 'user_id'
    `);
    
    const tradesCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'trades' AND column_name = 'user_id'
    `);
    
    const watchlistCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'watchlist' AND column_name = 'user_id'
    `);
    
    // Get the first admin user, or first user if no admin exists
    const adminResult = await client.query(`
      SELECT id FROM users WHERE is_admin = 'true' ORDER BY id LIMIT 1
    `);
    
    const firstUserResult = await client.query(`
      SELECT id FROM users ORDER BY id LIMIT 1
    `);
    
    const targetUserId = adminResult.rows[0]?.id || firstUserResult.rows[0]?.id;
    
    if (!targetUserId) {
      console.log("⚠ No users found. Migration will add columns but no data will be assigned.");
    } else {
      console.log(`✓ Found target user ID: ${targetUserId}`);
    }
    
    // Add userId column to holdings if it doesn't exist
    if (holdingsCheck.rows.length === 0) {
      console.log("Adding user_id column to holdings...");
      await client.query(`
        ALTER TABLE holdings 
        ADD COLUMN user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE
      `);
      
      if (targetUserId) {
        console.log(`Assigning existing holdings to user ${targetUserId}...`);
        await client.query(`
          UPDATE holdings SET user_id = $1 WHERE user_id IS NULL
        `, [targetUserId]);
      }
      
      await client.query(`
        ALTER TABLE holdings ALTER COLUMN user_id SET NOT NULL
      `);
      console.log("✓ Holdings migration complete");
    } else {
      console.log("✓ Holdings user_id column already exists");
    }
    
    // Add userId column to trades if it doesn't exist
    if (tradesCheck.rows.length === 0) {
      console.log("Adding user_id column to trades...");
      await client.query(`
        ALTER TABLE trades 
        ADD COLUMN user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE
      `);
      
      if (targetUserId) {
        console.log(`Assigning existing trades to user ${targetUserId}...`);
        await client.query(`
          UPDATE trades SET user_id = $1 WHERE user_id IS NULL
        `, [targetUserId]);
      }
      
      await client.query(`
        ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL
      `);
      console.log("✓ Trades migration complete");
    } else {
      console.log("✓ Trades user_id column already exists");
    }
    
    // Add userId column to watchlist if it doesn't exist
    if (watchlistCheck.rows.length === 0) {
      console.log("Adding user_id column to watchlist...");
      await client.query(`
        ALTER TABLE watchlist 
        ADD COLUMN user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE
      `);
      
      if (targetUserId) {
        console.log(`Assigning existing watchlist items to user ${targetUserId}...`);
        await client.query(`
          UPDATE watchlist SET user_id = $1 WHERE user_id IS NULL
        `, [targetUserId]);
      }
      
      await client.query(`
        ALTER TABLE watchlist ALTER COLUMN user_id SET NOT NULL
      `);
      console.log("✓ Watchlist migration complete");
    } else {
      console.log("✓ Watchlist user_id column already exists");
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
if (require.main === module) {
  migrateUserIdColumns()
    .then(() => {
      console.log("Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}
