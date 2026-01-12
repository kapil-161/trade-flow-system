import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { insertUserSchema, type User } from "@shared/schema";
import { z } from "zod";

const PgStore = connectPgSimple(session);

// Hash password using built-in crypto (no external dependencies)
async function hashPassword(password: string): Promise<string> {
  const crypto = await import("crypto");
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.pbkdf2(password, salt, 1000, 64, "sha512", (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ":" + derivedKey.toString("hex"));
    });
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const crypto = await import("crypto");
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    crypto.pbkdf2(password, salt, 1000, 64, "sha512", (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString("hex"));
    });
  });
}

// Create session table manually (connect-pg-simple SQL file isn't bundled)
async function ensureSessionTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
      
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
    console.log("Session table created/verified successfully");
  } catch (error) {
    console.error("Failed to create session table:", error);
    throw error;
  }
}

export async function setupAuth(app: Express) {
  // Session configuration with PostgreSQL store
  const isProduction = process.env.NODE_ENV === "production";
  
  let sessionStore: any;
  try {
    // Test database connection first
    const client = await pool.connect();
    client.release();
    
    // Create session table manually (connect-pg-simple's SQL file isn't bundled)
    await ensureSessionTable();
    
    sessionStore = new PgStore({
      pool: pool,
      tableName: "session",
      createTableIfMissing: false, // We create it manually above
    });

    // Handle store errors gracefully
    if (sessionStore && typeof sessionStore.on === "function") {
      sessionStore.on("error", (error: Error) => {
        console.error("Session store error:", error);
      });
    }
    
    console.log("Session store initialized successfully");
  } catch (error) {
    console.error("Failed to initialize session store:", error);
    // Don't throw - allow app to start but sessions won't persist
    console.warn("Continuing without persistent session store - sessions will be in-memory only");
    sessionStore = undefined; // Use default MemoryStore
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "trade-flow-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        // Secure cookies in production (Render uses HTTPS)
        secure: isProduction,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Passport Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);

        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        }

        const isValid = await verifyPassword(password, user.password);

        if (!isValid) {
          return done(null, false, { message: "Incorrect password" });
        }

        return done(null, user);
      } catch (error) {
        console.error("Error in passport local strategy:", error);
        return done(error);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      done(error);
    }
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { username, password } = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
      });

      // Log in the user automatically
      req.login(user, (err) => {
        if (err) {
          console.error("Session login error during registration:", err);
          return res.status(500).json({ error: "Failed to establish session" });
        }
        res.status(201).json({
          id: user.id,
          username: user.username,
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) {
        console.error("Passport authentication error:", err);
        return res.status(500).json({ error: "Internal server error during authentication" });
      }

      if (!user) {
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }

      req.login(user, (err) => {
        if (err) {
          console.error("Session login error:", err);
          return res.status(500).json({ error: "Failed to establish session" });
        }
        res.json({
          id: user.id,
          username: user.username,
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as User;
      res.json({
        id: user.id,
        username: user.username,
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });
}

// Middleware to protect routes
export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}
