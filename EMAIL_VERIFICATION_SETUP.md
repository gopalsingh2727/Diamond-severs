# Email Verification Setup Guide

## Overview

The manager login system now includes email verification functionality. Managers must verify their email addresses before they can log in to the system.

## Features

### ✅ Email Verification
- **Secure token-based verification** (24-hour expiry)
- **Email validation** on login
- **Resend verification emails** for unverified accounts
- **Professional HTML email templates**

### 🔒 Enhanced Security
- **Account lockout** after 5 failed login attempts (2-hour lock)
- **Password reset** with secure tokens (1-hour expiry)
- **Active account check** during login
- **Login attempt tracking**

### 📧 Email Provider Support
- **Console logging** (development)
- **Nodemailer** (SMTP - Gmail, SendGrid, etc.)
- **AWS SES** (Simple Email Service)

---

## API Endpoints

### 1. Manager Login (Updated)
**POST** `/manager/login`

**Request:**
```json
{
  "email": "manager@example.com",
  "password": "securePassword123"
}
```

**Responses:**

**Success (200):**
```json
{
  "token": "jwt-token-here",
  "manager": {
    "id": "manager-id",
    "email": "manager@example.com",
    "username": "manager_username",
    "branchId": "branch-id",
    "lastLogin": "2025-11-15T10:30:00.000Z"
  }
}
```

**Email Not Verified (403):**
```json
{
  "message": "Email not verified. Please check your email for the verification link or request a new one.",
  "requiresVerification": true,
  "email": "manager@example.com"
}
```

**Account Locked (423):**
```json
{
  "message": "Account is locked due to multiple failed login attempts. Please try again later or contact support.",
  "lockUntil": "2025-11-15T12:30:00.000Z"
}
```

**Account Deactivated (403):**
```json
{
  "message": "Account is deactivated. Please contact your administrator."
}
```

**Invalid Credentials (401):**
```json
{
  "message": "Invalid credentials"
}
```

---

### 2. Send Email Verification
**POST** `/manager/send-verification`

Send or resend email verification link.

**Request:**
```json
{
  "email": "manager@example.com"
}
```

**Response (200):**
```json
{
  "message": "Verification email sent. Please check your inbox.",
  "email": "manager@example.com"
}
```

**Already Verified (400):**
```json
{
  "message": "Email is already verified"
}
```

---

### 3. Verify Email
**GET** `/manager/verify-email?token=<verification-token>`

Verify email address using the token from the email.

**Response (200):**
```json
{
  "message": "Email verified successfully! You can now log in.",
  "email": "manager@example.com",
  "verified": true
}
```

**Invalid/Expired Token (400):**
```json
{
  "message": "Invalid or expired verification token",
  "expired": true
}
```

---

### 4. Request Password Reset
**POST** `/manager/request-password-reset`

Request a password reset link.

**Request:**
```json
{
  "email": "manager@example.com"
}
```

**Response (200):**
```json
{
  "message": "Password reset link sent. Please check your inbox."
}
```

---

### 5. Reset Password
**POST** `/manager/reset-password`

Reset password using the token from the email.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newSecurePassword123"
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully! You can now log in with your new password.",
  "email": "manager@example.com"
}
```

**Invalid/Expired Token (400):**
```json
{
  "message": "Invalid or expired password reset token",
  "expired": true
}
```

**Password Too Short (400):**
```json
{
  "message": "Password must be at least 8 characters long"
}
```

---

## Environment Configuration

### Required Variables

Add these to your `.env` file:

```bash
# Email Configuration
EMAIL_PROVIDER=console              # Options: 'console', 'nodemailer', 'ses'
EMAIL_FROM=noreply@27manufacturing.com
FRONTEND_URL=http://localhost:3000  # For verification links

# For Nodemailer (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false                   # true for 465, false for other ports
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password         # Use App Password for Gmail

# For AWS SES
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Email Provider Setup

#### Option 1: Console (Development)
**Best for:** Local development and testing

```bash
EMAIL_PROVIDER=console
```

Emails will be logged to the console instead of being sent.

#### Option 2: Nodemailer + Gmail
**Best for:** Small-scale production, testing

1. **Install nodemailer:**
   ```bash
   npm install nodemailer
   ```

2. **Create Gmail App Password:**
   - Go to Google Account Settings
   - Security → 2-Step Verification → App Passwords
   - Generate password for "Mail"

3. **Configure `.env`:**
   ```bash
   EMAIL_PROVIDER=nodemailer
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   EMAIL_FROM=your-email@gmail.com
   ```

#### Option 3: AWS SES
**Best for:** Production, high volume

1. **Verify domain/email in AWS SES Console**
2. **Move out of SES Sandbox** (for production)
3. **Configure `.env`:**
   ```bash
   EMAIL_PROVIDER=ses
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   EMAIL_FROM=noreply@yourdomain.com
   ```

---

## Database Schema Updates

### Manager Model (Updated)

```javascript
{
  username: String,
  email: String,              // ✅ NEW: Required, unique, validated
  password: String,
  branchId: ObjectId,
  role: String,

  // Email Verification
  isEmailVerified: Boolean,   // ✅ NEW: Default false
  emailVerificationToken: String,
  emailVerificationExpires: Date,

  // Security
  isActive: Boolean,          // ✅ NEW: Default true
  loginAttempts: Number,      // ✅ NEW: Default 0
  lockUntil: Date,
  lastLogin: Date,

  // Password Reset
  passwordResetToken: String,
  passwordResetExpires: Date,

  createdAt: Date
}
```

### Migration Notes

For existing managers without email addresses:

```javascript
// Run this in MongoDB or via migration script
db.managers.updateMany(
  { email: { $exists: false } },
  {
    $set: {
      email: "pending@update.com",  // Placeholder
      isEmailVerified: false,
      isActive: true,
      loginAttempts: 0
    }
  }
)
```

Then manually update each manager's email and send verification.

---

## Testing

### 1. Test Email Verification Flow

```bash
# 1. Create a manager (ensure email field is set)
POST http://localhost:4000/manager/create
{
  "username": "test_manager",
  "email": "test@example.com",
  "password": "password123",
  "branchId": "branch-id-here"
}

# 2. Send verification email
POST http://localhost:4000/manager/send-verification
{
  "email": "test@example.com"
}

# 3. Check console for verification link (if using console mode)
# Copy the token from the link

# 4. Verify email
GET http://localhost:4000/manager/verify-email?token=<token-from-email>

# 5. Try login (should succeed now)
POST http://localhost:4000/manager/login
{
  "email": "test@example.com",
  "password": "password123"
}
```

### 2. Test Password Reset

```bash
# 1. Request password reset
POST http://localhost:4000/manager/request-password-reset
{
  "email": "test@example.com"
}

# 2. Check console for reset link
# Copy the token

# 3. Reset password
POST http://localhost:4000/manager/reset-password
{
  "token": "<token-from-email>",
  "newPassword": "newPassword456"
}

# 4. Login with new password
POST http://localhost:4000/manager/login
{
  "email": "test@example.com",
  "password": "newPassword456"
}
```

### 3. Test Account Lockout

```bash
# Try logging in with wrong password 5 times
# On 6th attempt, should get 423 status with account locked message
```

---

## Frontend Integration

### Login Flow

```javascript
async function handleLogin(email, password) {
  try {
    const response = await fetch('http://localhost:4000/manager/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'your-api-key'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Login successful
      localStorage.setItem('token', data.token);
      localStorage.setItem('manager', JSON.stringify(data.manager));
      window.location.href = '/dashboard';
    } else if (response.status === 403 && data.requiresVerification) {
      // Email not verified
      showEmailVerificationPrompt(email);
    } else if (response.status === 423) {
      // Account locked
      showAccountLockedMessage(data.lockUntil);
    } else {
      // Other error
      showError(data.message);
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Network error. Please try again.');
  }
}
```

### Resend Verification Email

```javascript
async function resendVerificationEmail(email) {
  const response = await fetch('http://localhost:4000/manager/send-verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key'
    },
    body: JSON.stringify({ email })
  });

  const data = await response.json();
  alert(data.message);
}
```

### Email Verification Page

```javascript
// On /verify-email page
async function verifyEmail() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    showError('Invalid verification link');
    return;
  }

  const response = await fetch(
    `http://localhost:4000/manager/verify-email?token=${token}`,
    {
      headers: { 'x-api-key': 'your-api-key' }
    }
  );

  const data = await response.json();

  if (response.ok) {
    showSuccess('Email verified! Redirecting to login...');
    setTimeout(() => window.location.href = '/login', 2000);
  } else {
    showError(data.message);
    if (data.expired) {
      showResendOption(data.email);
    }
  }
}
```

---

## Security Considerations

### ✅ Implemented Security Features

1. **Email Verification:** Prevents unauthorized account creation
2. **Account Lockout:** 5 failed attempts = 2-hour lock
3. **Token Expiry:**
   - Verification tokens: 24 hours
   - Password reset tokens: 1 hour
4. **Login Attempt Tracking:** Monitors and limits failed logins
5. **Password Hashing:** bcrypt with 10 rounds
6. **JWT Tokens:** 24-hour expiry
7. **API Key Validation:** All requests require valid API key

### 🔐 Best Practices

1. **Never expose tokens in logs** (already implemented)
2. **Use HTTPS in production** (configure in deployment)
3. **Set secure CORS policies** (already configured)
4. **Monitor failed login attempts** (logs available)
5. **Regular password rotation** (enforce via policy)

---

## Troubleshooting

### Email Not Sending

**Console Provider:**
- Check server logs for email output
- Verify `EMAIL_PROVIDER=console`

**Nodemailer:**
- Check SMTP credentials
- Verify Gmail App Password (not regular password)
- Check firewall/network settings
- Test with: `telnet smtp.gmail.com 587`

**AWS SES:**
- Verify email/domain in SES console
- Check SES sandbox status
- Verify IAM permissions
- Check CloudWatch logs

### Verification Token Expired

- Tokens expire after 24 hours
- Use the "Resend verification email" endpoint
- New token will be generated

### Account Locked

- Wait 2 hours for automatic unlock
- Or have admin manually unlock in database:
  ```javascript
  db.managers.updateOne(
    { email: "manager@example.com" },
    { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } }
  )
  ```

---

## Deployment Checklist

- [ ] Set `EMAIL_PROVIDER` to `nodemailer` or `ses`
- [ ] Configure SMTP/SES credentials
- [ ] Set `FRONTEND_URL` to production URL
- [ ] Set `EMAIL_FROM` to company email
- [ ] Test email delivery in staging
- [ ] Migrate existing managers to add email field
- [ ] Send verification emails to all managers
- [ ] Update frontend login flow
- [ ] Configure email templates (optional customization)
- [ ] Monitor CloudWatch for errors

---

## Cost Estimation

### AWS SES Pricing (ap-south-1)
- **First 62,000 emails/month:** FREE (via EC2/Lambda)
- **Additional emails:** $0.10 per 1,000 emails
- **Data transfer:** Included

### Example (100 managers, active system):
- Login verifications: ~100 emails/month
- Password resets: ~10 emails/month
- **Total cost:** $0 (under free tier)

---

## Support

For issues or questions:
- Check server logs: `serverless logs -f managerLogin`
- Monitor CloudWatch Logs
- Review [API_QUICK_REFERENCE.md](./API_QUICK_REFERENCE.md)
- Test with console provider first

---

**Version:** 1.0
**Last Updated:** November 15, 2025
**Author:** 27 Manufacturing Development Team
