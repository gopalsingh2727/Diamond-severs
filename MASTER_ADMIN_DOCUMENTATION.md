# 👑 Master Admin Documentation

Complete guide for Master Admin system - the super administrator with system-wide access.

---

## 🎯 Overview

Master Admin is the highest level of access in the 27 Manufacturing Management System. Master Admins have complete visibility and control across all branches, users, orders, and system operations.

### Master Admin vs Regular Admin

| Feature | Master Admin | Regular Admin |
|---------|--------------|---------------|
| Access Scope | All branches | Single branch |
| User Management | All users | Branch users only |
| System Analytics | Yes | No |
| Branch Management | Full control | View only |
| Super Admin Powers | Optional | No |

---

## 🔐 Authentication

### Login Endpoint

**POST** `/master-admin/login`

**Request:**
```json
{
  "username": "superadmin",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "507f1f77bcf86cd799439011",
    "username": "superadmin",
    "email": "admin@company.com",
    "fullName": "Super Administrator",
    "role": "master_admin",
    "isSuperAdmin": true,
    "permissions": [
      "view_all_branches",
      "manage_branches",
      "view_all_users",
      ...
    ]
  }
}
```

**Security Features:**
- ✅ Account lockout after 5 failed attempts (2 hours)
- ✅ Password hashed with bcrypt (12 rounds)
- ✅ JWT token with 24-hour expiry
- ✅ Login attempt tracking
- ✅ Last login timestamp

---

## 👤 Master Admin Management

### 1. Create Master Admin (Super Admin Only)

**POST** `/master-admin/create`

**Headers:**
```
Authorization: Bearer <super-admin-token>
x-api-key: your-api-key
```

**Request:**
```json
{
  "username": "newadmin",
  "email": "newadmin@company.com",
  "password": "SecurePass123!",
  "fullName": "New Administrator",
  "phone": "+1234567890",
  "isSuperAdmin": false,
  "permissions": [
    "view_all_branches",
    "view_all_users",
    "view_analytics"
  ]
}
```

**Response:**
```json
{
  "message": "Master admin created successfully",
  "admin": {
    "id": "507f1f77bcf86cd799439012",
    "username": "newadmin",
    "email": "newadmin@company.com",
    "fullName": "New Administrator",
    "role": "master_admin",
    "isSuperAdmin": false,
    "permissions": ["view_all_branches", ...],
    "isActive": true,
    "createdAt": "2025-11-14T..."
  }
}
```

---

### 2. Get All Master Admins

**GET** `/master-admin/all?page=1&limit=50&isActive=true&isSuperAdmin=false`

**Response:**
```json
{
  "admins": [
    {
      "id": "507f1f77bcf86cd799439011",
      "username": "superadmin",
      "email": "admin@company.com",
      "fullName": "Super Administrator",
      "role": "master_admin",
      "isSuperAdmin": true,
      "isActive": true,
      "lastLogin": "2025-11-14T10:30:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 5,
    "pages": 1
  }
}
```

---

### 3. Get Master Admin by ID

**GET** `/master-admin/{id}`

---

### 4. Update Master Admin

**PUT** `/master-admin/{id}`

**Request:**
```json
{
  "fullName": "Updated Name",
  "phone": "+1234567890",
  "email": "newemail@company.com",
  "isActive": true,
  "isSuperAdmin": false,
  "permissions": ["view_all_branches", "manage_branches"]
}
```

**Note:** Only super admins can change `isSuperAdmin` status.

---

### 5. Deactivate Master Admin (Super Admin Only)

**DELETE** `/master-admin/{id}`

**Note:** This performs a soft delete (sets `isActive: false`). Cannot delete your own account.

---

### 6. Change Password

**POST** `/master-admin/change-password`

**Request:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword123!"
}
```

**Validation:**
- ✅ New password must be at least 8 characters
- ✅ Current password must be correct

---

### 7. Get Current Admin Info

**GET** `/master-admin/me`

Returns the currently logged-in master admin's information.

---

## 📊 System Dashboard & Analytics

### 1. System-Wide Dashboard

**GET** `/master-admin/dashboard`

**Response:**
```json
{
  "summary": {
    "branches": {
      "total": 15,
      "active": 14,
      "inactive": 1
    },
    "users": {
      "managers": {
        "total": 45,
        "active": 42
      },
      "operators": 150
    },
    "machines": {
      "total": 200,
      "active": 180,
      "inactive": 20,
      "utilization": "90.00"
    },
    "customers": 500,
    "orders": {
      "total": 10000,
      "pending": 50,
      "inProgress": 200,
      "completed": 9750,
      "today": 45,
      "completedToday": 40,
      "completionRate": "97.50"
    }
  },
  "branchSummary": [
    {
      "branchId": "507f1f77bcf86cd799439011",
      "branchName": "Branch A",
      "totalOrders": 3000,
      "pendingOrders": 10,
      "inProgressOrders": 50,
      "completedOrders": 2940
    }
  ],
  "timestamp": "2025-11-14T12:00:00.000Z"
}
```

**Key Metrics:**
- Total branches and their status
- User counts (managers, operators)
- Machine utilization
- Order statistics
- Completion rates
- Top performing branches

---

### 2. Branches Overview

**GET** `/master-admin/branches/overview`

**Response:**
```json
{
  "branches": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "branchName": "Branch A",
      "location": "City, State",
      "contactNumber": "+1234567890",
      "email": "brancha@company.com",
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "stats": {
        "managers": 5,
        "operators": 20,
        "machines": {
          "total": 25,
          "active": 22
        },
        "orders": {
          "total": 3000,
          "pending": 10
        },
        "customers": 50
      }
    }
  ],
  "total": 15
}
```

---

### 3. System Analytics

**GET** `/master-admin/analytics?days=30`

**Response:**
```json
{
  "period": {
    "days": 30,
    "startDate": "2025-10-15T00:00:00.000Z",
    "endDate": "2025-11-14T00:00:00.000Z"
  },
  "ordersOverTime": [
    {
      "_id": "2025-11-14",
      "statuses": [
        { "status": "completed", "count": 40 },
        { "status": "in_progress", "count": 5 }
      ],
      "total": 45
    }
  ],
  "branchPerformance": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "branchName": "Branch A",
      "totalOrders": 500,
      "completedOrders": 480,
      "completionRate": 96.0,
      "avgCompletionTimeHours": 24.5
    }
  ],
  "machineUtilization": [
    { "_id": "running", "count": 180 },
    { "_id": "offline", "count": 15 },
    { "_id": "maintenance", "count": 5 }
  ],
  "topCustomers": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "customerName": "ABC Company",
      "contactNumber": "+1234567890",
      "orderCount": 150
    }
  ]
}
```

**Analytics Included:**
- Orders trend over time
- Branch performance comparison
- Machine utilization across system
- Top customers by order count
- Completion rates and times

---

### 4. Activity Logs

**GET** `/master-admin/activity-logs?page=1&limit=50&days=7`

**Response:**
```json
{
  "recentLogins": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "username": "superadmin",
      "email": "admin@company.com",
      "lastLogin": "2025-11-14T10:30:00.000Z"
    }
  ],
  "recentOrders": [
    {
      "_id": "507f1f77bcf86cd799439030",
      "orderNumber": "ORD-BRA-20251114-001",
      "status": "completed",
      "branchId": {
        "_id": "507f1f77bcf86cd799439011",
        "branchName": "Branch A"
      },
      "customerId": {
        "_id": "507f1f77bcf86cd799439020",
        "customerName": "ABC Company"
      },
      "updatedAt": "2025-11-14T11:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 200,
    "pages": 4
  }
}
```

---

### 5. System Health

**GET** `/master-admin/system-health`

**Response:**
```json
{
  "database": {
    "status": "healthy",
    "size": "1024.50 MB",
    "collections": 15,
    "indexes": 45
  },
  "alerts": {
    "lockedAdmins": 0,
    "inactiveBranches": 1,
    "offlineMachines": 5,
    "overdueOrders": 3
  },
  "timestamp": "2025-11-14T12:00:00.000Z",
  "overallStatus": "healthy"
}
```

**Health Indicators:**
- Database connection status
- Database size and stats
- System alerts (locked accounts, offline machines, etc.)
- Overall health status

---

## 🔑 Permissions System

Master Admins can have different permission levels:

### Available Permissions

| Permission | Description |
|------------|-------------|
| `view_all_branches` | View all branch data |
| `manage_branches` | Create/update/delete branches |
| `view_all_users` | View all users across branches |
| `manage_users` | Create/update/delete users |
| `view_all_orders` | View all orders system-wide |
| `manage_orders` | Update/cancel orders |
| `view_analytics` | Access analytics dashboard |
| `manage_system_settings` | Change system configurations |
| `view_logs` | Access activity logs |
| `manage_admins` | Manage other master admins |
| `manage_managers` | Manage branch managers |
| `manage_operators` | Manage machine operators |
| `manage_machines` | Manage machines across branches |
| `manage_products` | Manage product catalog |
| `manage_materials` | Manage materials |
| `view_financial_reports` | View financial data |
| `export_data` | Export system data |
| `backup_database` | Create database backups |

### Super Admin

Super Admins have ALL permissions by default and can:
- ✅ Create other master admins
- ✅ Grant super admin status
- ✅ Delete other master admins
- ✅ Override any permission check

---

## 🔒 Security Features

### 1. Account Lockout
- After 5 failed login attempts
- Account locked for 2 hours
- Automatic unlock after timeout
- Manual unlock by super admin

### 2. Password Security
- Minimum 8 characters
- Hashed with bcrypt (12 rounds)
- Password history (optional)
- Password expiry (optional)

### 3. Session Management
- JWT tokens with 24-hour expiry
- Refresh token mechanism (optional)
- Logout invalidates token
- Device tracking (optional)

### 4. Two-Factor Authentication (Optional)
- TOTP-based 2FA
- Backup codes
- Required for super admins

### 5. Audit Trail
- All actions logged
- IP address tracking
- User agent logging
- Timestamp tracking

---

## 📱 Usage Examples

### Login Flow

```javascript
// 1. Login
const loginResponse = await fetch('/master-admin/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key'
  },
  body: JSON.stringify({
    username: 'superadmin',
    password: 'SecurePassword123!'
  })
});

const { token, admin } = await loginResponse.json();

// 2. Store token
localStorage.setItem('masterAdminToken', token);

// 3. Use token for authenticated requests
const dashboardResponse = await fetch('/master-admin/dashboard', {
  headers: {
    'x-api-key': 'your-api-key',
    'Authorization': `Bearer ${token}`
  }
});

const dashboard = await dashboardResponse.json();
```

### Creating a New Master Admin

```javascript
const createAdmin = async (adminData) => {
  const response = await fetch('/master-admin/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key',
      'Authorization': `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      username: 'newadmin',
      email: 'newadmin@company.com',
      password: 'SecurePass123!',
      fullName: 'New Administrator',
      phone: '+1234567890',
      isSuperAdmin: false,
      permissions: [
        'view_all_branches',
        'view_all_users',
        'view_analytics'
      ]
    })
  });

  return await response.json();
};
```

---

## 🚨 Error Handling

### Common Error Codes

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Invalid credentials |
| 403 | Forbidden | Insufficient permissions |
| 423 | Locked | Account is locked |
| 404 | Not Found | Admin not found |
| 500 | Server Error | Internal server error |

### Example Error Response

```json
{
  "message": "Invalid credentials",
  "code": 401
}
```

---

## 🎯 Best Practices

### 1. Password Management
- Use strong, unique passwords
- Change passwords every 90 days
- Never share credentials
- Use password manager

### 2. Permission Assignment
- Grant minimum necessary permissions
- Regular permission audits
- Remove unused accounts
- Use super admin sparingly

### 3. Security
- Enable 2FA for all master admins
- Monitor login attempts
- Review activity logs regularly
- Set up alerts for suspicious activity

### 4. Access Control
- Limit number of super admins (2-3 maximum)
- Create role-based master admins
- Document permission changes
- Regular access reviews

---

## 📊 Complete Endpoint List

### Authentication (3 endpoints)
- `POST /master-admin/login`
- `POST /master-admin/change-password`
- `GET /master-admin/me`

### Management (5 endpoints)
- `POST /master-admin/create`
- `GET /master-admin/all`
- `GET /master-admin/{id}`
- `PUT /master-admin/{id}`
- `DELETE /master-admin/{id}`

### Analytics (5 endpoints)
- `GET /master-admin/dashboard`
- `GET /master-admin/branches/overview`
- `GET /master-admin/analytics`
- `GET /master-admin/activity-logs`
- `GET /master-admin/system-health`

**Total: 13 endpoints**

---

## 🔄 Migration Guide

### Creating First Super Admin

```javascript
// Run this script once to create the first super admin
const mongoose = require('mongoose');
const MasterAdmin = require('./models/masterAdmin/masterAdmin');

async function createSuperAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const superAdmin = new MasterAdmin({
    username: 'superadmin',
    email: 'admin@yourcompany.com',
    password: 'ChangeThisPassword123!', // Will be hashed automatically
    fullName: 'Super Administrator',
    phone: '+1234567890',
    isSuperAdmin: true,
    isActive: true
  });

  await superAdmin.save();
  console.log('Super admin created successfully!');
  console.log('Username:', superAdmin.username);
  console.log('Please change the password after first login');

  await mongoose.disconnect();
}

createSuperAdmin();
```

---

## 🎓 Training Resources

### For New Master Admins
1. Complete system overview
2. Permission system understanding
3. Analytics interpretation
4. Security best practices
5. Incident response procedures

### Documentation
- System architecture guide
- API documentation
- Security policies
- Troubleshooting guide

---

## 📞 Support

For master admin issues:
1. Check system health endpoint
2. Review activity logs
3. Contact technical support
4. Escalate to super admin if needed

---

**Last Updated:** November 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
