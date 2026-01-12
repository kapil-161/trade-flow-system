# Password Reset Feature Setup

This document explains how to set up email-based password reset functionality.

## Overview

The system now requires **email addresses as usernames** and includes a complete password reset flow:

1. Users can request a password reset via the "Forgot Password" link on the login page
2. A reset link is sent to their email address
3. Users click the link to reset their password
4. The reset link expires after 1 hour

## Email Configuration

To enable email sending, you need to configure SMTP settings via environment variables:

### Required Environment Variables

```bash
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com          # Your SMTP server hostname
SMTP_PORT=587                      # SMTP port (587 for TLS, 465 for SSL)
SMTP_SECURE=false                  # true for SSL (port 465), false for TLS (port 587)
SMTP_USER=your-email@gmail.com    # Your SMTP username/email
SMTP_PASSWORD=your-app-password    # Your SMTP password or app password

# Application URL (for reset links)
APP_URL=https://your-app.onrender.com  # Your app's public URL
# OR use Render's automatic variable:
# RENDER_EXTERNAL_URL is automatically set by Render
```

### Gmail Setup Example

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this app password as `SMTP_PASSWORD`

3. **Set Environment Variables**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   ```

### Other Email Providers

**SendGrid:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

**Mailgun:**
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
```

**Outlook/Office 365:**
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

## Database Migration

The password reset feature requires two new columns in the `users` table:
- `reset_token` (TEXT) - Stores the reset token
- `reset_token_expiry` (TIMESTAMP) - Stores when the token expires

These columns are automatically added when the server starts via the migration in `server/migrate-reset-token.ts`.

To manually run the migration:
```bash
npm run tsx server/migrate-reset-token.ts
```

## Features

### Email Validation
- Username must be a valid email address
- Email is normalized to lowercase during registration and login
- Email format is validated on both frontend and backend

### Security Features
- Reset tokens expire after 1 hour
- Tokens are cryptographically secure (32-byte random)
- Email enumeration protection (always returns success message)
- Tokens are cleared after successful password reset
- Password must be at least 6 characters

### User Flow

1. **Forgot Password Page** (`/forgot-password`)
   - User enters their email address
   - System sends reset email (if account exists)
   - User receives confirmation message

2. **Reset Password Page** (`/reset-password?token=...`)
   - Token is verified automatically
   - User enters new password
   - Password is updated and user is redirected to login

## Testing Without Email

If SMTP is not configured, the system will:
- Still accept password reset requests
- Log a warning message
- Return success (for security - prevents email enumeration)
- But no email will actually be sent

To test the full flow without email, you can:
1. Check server logs for the reset token
2. Manually construct the reset URL: `/reset-password?token=<token-from-logs>`
3. Or configure a test SMTP service like Mailtrap

## Troubleshooting

### Email Not Sending
- Check that all SMTP environment variables are set
- Verify SMTP credentials are correct
- Check server logs for SMTP connection errors
- Ensure firewall allows outbound SMTP connections (port 587/465)

### Reset Link Not Working
- Verify `APP_URL` or `RENDER_EXTERNAL_URL` is set correctly
- Check that the token hasn't expired (1 hour limit)
- Ensure the token matches exactly (case-sensitive)

### "Invalid Token" Error
- Token may have expired (check expiry time)
- Token may have already been used
- Token may be incorrect (check URL encoding)

## API Endpoints

- `POST /api/auth/forgot-password` - Request password reset
- `GET /api/auth/verify-reset-token?token=...` - Verify reset token
- `POST /api/auth/reset-password` - Reset password with token
