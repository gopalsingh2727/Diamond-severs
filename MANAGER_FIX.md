# Manager Login Fix

## Problem
Manager `test@gmail.com` has `emailVerified: false` which blocks login.

## Quick Fix - Update Existing Manager

### Option 1: Using MongoDB Compass or Shell
```javascript
// Connect to: MasterAdminDB database
// Run this in the MongoDB shell or Compass query:

db.managers.updateOne(
  { email: "test@gmail.com" },
  {
    $set: {
      emailVerified: true,
      isActive: true,
      loginAttempts: 0
    },
    $unset: {
      lockUntil: "",
      emailVerificationToken: "",
      emailVerificationExpires: ""
    }
  }
)
```

### Option 2: Using Node Script
```bash
cd /Users/gopalsingh/Desktop/27/27mainAll/main27Backend
npm install  # If not already installed
node scripts/verifyManager.js
```

## After Fix
Test login with:
```json
POST /dev/manager/login
Headers: x-api-key: 27infinity.in_5f84c89315f74a2db149c06a93cf4820

{
  "email": "test@gmail.com",
  "password": "1234567"
}
```

## To Create New Manager with Auto-Verification

If you want new managers to be automatically verified, you need to:

1. **Use MasterAdminBackend** to create managers (it handles verification)
2. **OR** Modify the create manager handler in main27Backend

### Current Manager Document
```json
{
  "_id": "69189b830318959c9dd2e4ba",
  "username": "test",
  "email": "test@gmail.com",
  "branchId": "69189b5bd6bdbb49a22912de",
  "product27InfinityId": "691884b5f1ab320a9b3ec588",
  "isActive": true,
  "emailVerified": false,  // ← This needs to be true
  "phoneVerified": false,
  "createdAt": "2024-11-12T...",
  "updatedAt": "2024-11-12T..."
}
```

## Permanent Solution

To automatically verify managers on creation, update the Manager creation handler:

```javascript
// In handlers/Manager/createManager.js (or similar)
const newManager = new Manager({
  ...managerData,
  emailVerified: true,  // Auto-verify for now
  isActive: true
});
```

Or remove the email verification check from login temporarily:
```javascript
// In handlers/Manager/Manager.js line 57-64
// Comment out or remove the emailVerified check
```
