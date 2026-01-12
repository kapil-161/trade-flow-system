import nodemailer from "nodemailer";
import { storage } from "./storage";

// Cache for transporter
let transporter: nodemailer.Transporter | null = null;
let transporterConfig: any = null;

async function getEmailConfig() {
  // Try to get from database first
  try {
    const smtpHost = await storage.getSetting("smtp_host");
    const smtpPort = await storage.getSetting("smtp_port");
    const smtpSecure = await storage.getSetting("smtp_secure");
    const smtpUser = await storage.getSetting("smtp_user");
    const smtpPassword = await storage.getSetting("smtp_password");

    if (smtpUser?.value && smtpPassword?.value) {
      return {
        host: smtpHost?.value || "smtp.gmail.com",
        port: parseInt(smtpPort?.value || "587"),
        secure: smtpSecure?.value === "true",
        auth: {
          user: smtpUser.value,
          pass: smtpPassword.value,
        },
      };
    }
  } catch (error) {
    console.warn("Failed to load SMTP config from database:", error);
  }

  // Fall back to environment variables
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASSWORD || "",
    },
  };
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const emailConfig = await getEmailConfig();

  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    return null;
  }

  // Check if config changed, recreate transporter if needed
  const configKey = JSON.stringify(emailConfig);
  if (transporterConfig !== configKey || !transporter) {
    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth,
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000, // 10 seconds
      socketTimeout: 10000, // 10 seconds
      // For TLS
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });
    transporterConfig = configKey;
  }

  return transporter;
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  resetUrl: string
): Promise<boolean> {
  const mailTransporter = await getTransporter();
  
  if (!mailTransporter) {
    console.error("Cannot send email: SMTP not configured");
    return false;
  }

  const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5000";
  const fullResetUrl = `${appUrl}/reset-password?token=${resetToken}`;
  const emailConfig = await getEmailConfig();

  const mailOptions = {
    from: `"Trade Flow System" <${emailConfig.auth.user}>`,
    to: email,
    subject: "Password Reset Request - Trade Flow System",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .button:hover { background: #5568d3; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset your password for your Trade Flow System account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center;">
                <a href="${fullResetUrl}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${fullResetUrl}</p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul>
                  <li>This link will expire in 1 hour</li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>Never share this link with anyone</li>
                </ul>
              </div>
              <p>If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from Trade Flow System. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Password Reset Request - Trade Flow System

Hello,

We received a request to reset your password for your Trade Flow System account.

Click the link below to reset your password:
${fullResetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

---
This is an automated message from Trade Flow System.
    `,
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    console.log(`✓ Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return false;
  }
}

export async function sendPasswordResetSuccessEmail(email: string): Promise<boolean> {
  const mailTransporter = await getTransporter();
  
  if (!mailTransporter) {
    return false;
  }

  const emailConfig = await getEmailConfig();

  const mailOptions = {
    from: `"Trade Flow System" <${emailConfig.auth.user}>`,
    to: email,
    subject: "Password Reset Successful - Trade Flow System",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Password Reset Successful</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Your password has been successfully reset.</p>
              <p>If you did not make this change, please contact support immediately.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from Trade Flow System.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending success email:", error);
    return false;
  }
}

export async function sendTestEmail(toEmail: string): Promise<boolean> {
  const mailTransporter = await getTransporter();
  
  if (!mailTransporter) {
    throw new Error("SMTP not configured. Please configure SMTP settings first.");
  }

  // Verify connection before sending
  try {
    await mailTransporter.verify();
  } catch (error: any) {
    console.error("SMTP connection verification failed:", error);
    throw new Error(`SMTP connection failed: ${error.message || "Unable to connect to SMTP server. Please check your settings."}`);
  }

  const emailConfig = await getEmailConfig();
  const fromEmail = emailConfig.auth.user;

  const mailOptions = {
    from: `"Trade Flow System" <${fromEmail}>`,
    to: toEmail,
    subject: "Test Email - Trade Flow System",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Test Email Successful</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>This is a test email from your Trade Flow System.</p>
              <p>If you received this email, your SMTP configuration is working correctly!</p>
              <p><strong>SMTP Settings:</strong></p>
              <ul>
                <li>Host: ${emailConfig.host}</li>
                <li>Port: ${emailConfig.port}</li>
                <li>Secure: ${emailConfig.secure ? "Yes (SSL)" : "No (TLS)"}</li>
                <li>From: ${fromEmail}</li>
              </ul>
            </div>
            <div class="footer">
              <p>This is an automated test message from Trade Flow System.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Test Email - Trade Flow System

Hello,

This is a test email from your Trade Flow System.

If you received this email, your SMTP configuration is working correctly!

SMTP Settings:
- Host: ${emailConfig.host}
- Port: ${emailConfig.port}
- Secure: ${emailConfig.secure ? "Yes (SSL)" : "No (TLS)"}
- From: ${fromEmail}
    `,
  };

  try {
    // Set a timeout for sending email (30 seconds)
    const sendPromise = mailTransporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Email sending timed out after 30 seconds. Check your SMTP settings and network connection.")), 30000);
    });

    await Promise.race([sendPromise, timeoutPromise]);
    console.log(`✓ Test email sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error("Error sending test email:", error);
    
    // Provide more helpful error messages
    if (error.message?.includes("timeout")) {
      throw new Error("Connection timeout. Check your SMTP host, port, and network connection.");
    } else if (error.code === "EAUTH") {
      throw new Error("Authentication failed. Please check your SMTP username and password.");
    } else if (error.code === "ECONNECTION") {
      throw new Error("Could not connect to SMTP server. Check your SMTP host and port settings.");
    } else if (error.code === "ETIMEDOUT") {
      throw new Error("Connection timed out. The SMTP server may be unreachable or your network is blocking the connection.");
    }
    
    throw error;
  }
}

export async function sendAlertEmail(params: {
  to: string;
  alertName: string;
  symbol: string;
  price: number;
  conditionsMet: string[];
  triggeredAt: Date;
}): Promise<boolean> {
  const mailTransporter = await getTransporter();

  if (!mailTransporter) {
    console.error("Cannot send alert email: SMTP not configured");
    return false;
  }

  const emailConfig = await getEmailConfig();
  const appUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5000";

  const conditionsHtml = params.conditionsMet
    .map(condition => `<li style="margin: 10px 0;">${condition}</li>`)
    .join("");

  const mailOptions = {
    from: `"Trade Flow System Alerts" <${emailConfig.auth.user}>`,
    to: params.to,
    subject: `🚨 Alert Triggered: ${params.alertName} (${params.symbol})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .alert-box { background: #fff; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .price { font-size: 32px; font-weight: bold; color: #f59e0b; margin: 10px 0; }
            .conditions { background: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .button:hover { background: #d97706; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .timestamp { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Alert Triggered!</h1>
            </div>
            <div class="content">
              <div class="alert-box">
                <h2 style="margin-top: 0;">${params.alertName}</h2>
                <p style="font-size: 18px; margin: 10px 0;"><strong>Symbol:</strong> ${params.symbol}</p>
                <p style="margin: 10px 0;"><strong>Current Price:</strong></p>
                <div class="price">$${params.price.toFixed(2)}</div>
                <p class="timestamp">Triggered at: ${params.triggeredAt.toLocaleString()}</p>
              </div>

              <div class="conditions">
                <h3 style="margin-top: 0;">✅ Conditions Met:</h3>
                <ul style="margin: 10px 0; padding-left: 25px;">
                  ${conditionsHtml}
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="${appUrl}/alerts" class="button">View Alert Dashboard</a>
              </div>

              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                <strong>Note:</strong> This is an automated alert from Trade Flow System.
                Please review the market conditions and make informed trading decisions.
              </p>
            </div>
            <div class="footer">
              <p>This is an automated alert from Trade Flow System. You can manage your alerts in the dashboard.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
🚨 Alert Triggered: ${params.alertName}

Symbol: ${params.symbol}
Current Price: $${params.price.toFixed(2)}
Triggered at: ${params.triggeredAt.toLocaleString()}

Conditions Met:
${params.conditionsMet.map(c => `- ${c}`).join("\n")}

View your alerts: ${appUrl}/alerts

---
This is an automated alert from Trade Flow System.
    `,
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    console.log(`✓ Alert email sent to ${params.to} for ${params.symbol}`);
    return true;
  } catch (error) {
    console.error("Error sending alert email:", error);
    return false;
  }
}
