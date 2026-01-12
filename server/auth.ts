import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { insertUserSchema, type User } from "@shared/schema";
import { z } from "zod";
import { sendPasswordResetEmail, sendPasswordResetSuccessEmail } from "./email";
import { randomBytes } from "crypto";

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
        // Normalize username to lowercase email
        const email = username.toLowerCase().trim();
        const user = await storage.getUserByUsername(email);

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

      // Ensure username is lowercase email
      const email = username.toLowerCase().trim();
      
      // Validate email format (schema already does this, but double-check)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Username must be a valid email address" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user (use normalized email as username)
      const user = await storage.createUser({
        username: email,
        password: hashedPassword,
        isAdmin: "false",
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
          isAdmin: user.isAdmin === "true",
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
        isAdmin: user.isAdmin === "true",
      });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // Password reset request endpoint
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Find user by email (username is email)
      const user = await storage.getUserByUsername(email.toLowerCase().trim());

      // Always return success to prevent email enumeration attacks
      // But only send email if user exists
      if (user) {
        // Generate reset token
        const resetToken = randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date();
        resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Token expires in 1 hour

        // Save reset token to database
        await storage.updateUser(user.id, {
          resetToken,
          resetTokenExpiry,
        });

        // Send password reset email
        const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5000";
        const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
        
        await sendPasswordResetEmail(user.username, resetToken, resetUrl);
      }

      // Always return success message (security best practice)
      res.json({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      console.error("Error in forgot password:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Verify reset token endpoint
  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Reset token is required" });
      }

      // Find user with this reset token
      const users = await storage.getAllUsers();
      const user = users.find(
        (u) => u.resetToken === token && u.resetTokenExpiry && new Date(u.resetTokenExpiry) > new Date()
      );

      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      res.json({ valid: true, email: user.username });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({ error: "Failed to verify reset token" });
    }
  });

  // Reset password endpoint
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Reset token is required" });
      }

      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Find user with this reset token
      const users = await storage.getAllUsers();
      const user = users.find(
        (u) => u.resetToken === token && u.resetTokenExpiry && new Date(u.resetTokenExpiry) > new Date()
      );

      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password and clear reset token
      await storage.updateUser(user.id, {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      });

      // Send success email
      await sendPasswordResetSuccessEmail(user.username);

      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });
}

// Middleware to require admin access
export function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const user = req.user as User;
  if (user.isAdmin !== "true") {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
}

// Middleware to protect routes
export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}
