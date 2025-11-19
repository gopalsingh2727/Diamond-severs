# 💼 Subscription Management Dashboard Documentation

Complete guide for managing company subscriptions, tracking usage, monitoring support tickets, and analyzing revenue for the 27 Manufacturing Management System.

---

## 🎯 Overview

The Subscription Management Dashboard provides Master Admins with comprehensive tools to:
- **Manage Companies**: Track all companies using the software
- **Monitor Subscriptions**: View subscription status (pending, active, expired)
- **Track Usage**: Monitor branch count, user count, and resource usage
- **Support Management**: Track support tickets and calls
- **Revenue Analytics**: Monitor MRR, ARR, and revenue trends

---

## 📊 Dashboard Features

### Key Metrics Tracked

| Metric | Description |
|--------|-------------|
| Total Companies | Number of companies using the system |
| Active Subscriptions | Companies with active subscriptions |
| Pending Subscriptions | Companies awaiting activation |
| Total Branches | Branches across all companies |
| Support Tickets | Open, resolved, and closed tickets |
| Monthly Revenue | MRR from all subscriptions |
| Annual Revenue | ARR projection |

---

## 🔌 API Endpoints

### 1. Get Subscription Dashboard Overview

**GET** `/master-admin/subscription-dashboard`

Returns comprehensive overview of all subscriptions, companies, and support metrics.

**Headers:**
```
Authorization: Bearer <master-admin-token>
x-api-key: your-api-key
```

**Response:**
```json
{
  "summary": {
    "totalCompanies": 50,
    "totalBranches": 150,
    "statusBreakdown": {
      "active": 40,
      "pending": 5,
      "suspended": 2,
      "cancelled": 2,
      "expired": 1
    },
    "planBreakdown": {
      "trial": { "count": 10, "revenue": 0 },
      "basic": { "count": 15, "revenue": 15000 },
      "professional": { "count": 20, "revenue": 40000 },
      "enterprise": { "count": 5, "revenue": 25000 }
    },
    "revenue": {
      "monthlyRecurring": 80000,
      "annualRecurring": 960000,
      "totalAnnual": 960000
    },
    "supportTickets": {
      "open": 15,
      "in_progress": 10,
      "pending_customer": 5,
      "resolved": 100,
      "closed": 500,
      "total": 630
    }
  },
  "alerts": {
    "expiringSubscriptions": 3,
    "trialCompanies": 10,
    "suspendedCompanies": 2
  },
  "expiringSubscriptions": [
    {
      "companyName": "ABC Manufacturing",
      "email": "admin@abc.com",
      "subscription": {
        "plan": "professional",
        "endDate": "2025-12-01T00:00:00.000Z",
        "amount": 2000
      }
    }
  ],
  "trialCompanies": [
    {
      "companyName": "XYZ Industries",
      "email": "admin@xyz.com",
      "subscription": {
        "trialEndDate": "2025-11-30T00:00:00.000Z"
      }
    }
  ],
  "suspendedCompanies": [],
  "recentCompanies": [
    {
      "companyName": "New Company Inc",
      "email": "admin@newco.com",
      "subscription": {
        "plan": "trial",
        "status": "active"
      },
      "createdAt": "2025-11-14T00:00:00.000Z"
    }
  ],
  "timestamp": "2025-11-14T12:00:00.000Z"
}
```

**Use Cases:**
- Master Admin dashboard home page
- Executive reporting
- Quick system health check
- Identify companies needing attention

---

### 2. Get All Companies

**GET** `/master-admin/companies?page=1&limit=50&status=active&plan=professional&search=company`

Returns paginated list of all companies with filtering options.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `status` (optional): Filter by subscription status (active, pending, suspended, cancelled, expired)
- `plan` (optional): Filter by plan (trial, basic, professional, enterprise, custom)
- `isActive` (optional): Filter by active status (true/false)
- `search` (optional): Search by company name, code, or email

**Response:**
```json
{
  "companies": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "companyName": "ABC Manufacturing",
      "companyCode": "ABC1234",
      "email": "admin@abc.com",
      "phone": "+1234567890",
      "subscription": {
        "plan": "professional",
        "status": "active",
        "startDate": "2025-01-01T00:00:00.000Z",
        "endDate": "2026-01-01T00:00:00.000Z",
        "billingCycle": "yearly",
        "amount": 24000,
        "currency": "USD"
      },
      "usage": {
        "branches": 5,
        "users": 50,
        "machines": 100,
        "orders": 5000
      },
      "limits": {
        "maxBranches": 10,
        "maxUsers": 100,
        "maxMachines": 200
      },
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

**Use Cases:**
- Company management page
- Searching for specific companies
- Filtering by subscription status
- Exporting company lists

---

### 3. Get Company by ID

**GET** `/master-admin/companies/{id}`

Returns detailed information for a specific company including branches, orders, and support tickets.

**Response:**
```json
{
  "company": {
    "_id": "507f1f77bcf86cd799439011",
    "companyName": "ABC Manufacturing",
    "companyCode": "ABC1234",
    "email": "admin@abc.com",
    "phone": "+1234567890",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "country": "USA",
      "zipCode": "10001"
    },
    "subscription": {
      "plan": "professional",
      "status": "active",
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2026-01-01T00:00:00.000Z",
      "amount": 24000
    },
    "usage": {
      "branches": 5,
      "users": 50,
      "machines": 100
    },
    "primaryContact": {
      "name": "John Doe",
      "email": "john@abc.com",
      "phone": "+1234567890"
    }
  },
  "branches": {
    "total": 5,
    "active": 4,
    "list": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "branchName": "NYC Branch",
        "location": "New York, NY",
        "isActive": true
      }
    ]
  },
  "orders": {
    "total": 5000,
    "pending": 50,
    "in_progress": 200,
    "completed": 4700,
    "cancelled": 50
  },
  "supportTickets": {
    "total": 25,
    "recent": [
      {
        "_id": "507f1f77bcf86cd799439030",
        "ticketNumber": "TKT-2511-0001",
        "subject": "Machine offline issue",
        "status": "in_progress",
        "priority": "high",
        "createdAt": "2025-11-14T00:00:00.000Z"
      }
    ]
  }
}
```

**Use Cases:**
- Company detail page
- Support context
- Usage monitoring
- Account management

---

### 4. Create Company

**POST** `/master-admin/companies`

Creates a new company in the system.

**Request:**
```json
{
  "companyName": "New Company Inc",
  "email": "admin@newcompany.com",
  "phone": "+1234567890",
  "address": {
    "street": "456 Oak St",
    "city": "Los Angeles",
    "state": "CA",
    "country": "USA",
    "zipCode": "90001"
  },
  "industry": "Manufacturing",
  "companySize": "medium",
  "subscription": {
    "plan": "trial",
    "status": "active",
    "trialEndDate": "2025-12-01T00:00:00.000Z"
  },
  "limits": {
    "maxBranches": 1,
    "maxUsers": 10,
    "maxMachines": 10
  },
  "primaryContact": {
    "name": "Jane Smith",
    "email": "jane@newcompany.com",
    "phone": "+1234567890",
    "designation": "CEO"
  }
}
```

**Response:**
```json
{
  "message": "Company created successfully",
  "company": {
    "_id": "507f1f77bcf86cd799439099",
    "companyName": "New Company Inc",
    "companyCode": "NEW5678",
    "email": "admin@newcompany.com",
    "subscription": {
      "plan": "trial",
      "status": "active",
      "startDate": "2025-11-14T00:00:00.000Z",
      "trialEndDate": "2025-12-01T00:00:00.000Z"
    },
    "createdAt": "2025-11-14T00:00:00.000Z"
  }
}
```

**Automatic Features:**
- Company code auto-generated if not provided
- Trial subscription created by default (14 days)
- Default usage limits applied
- Onboarding steps initialized

---

### 5. Update Company

**PUT** `/master-admin/companies/{id}`

Updates company information, subscription, or limits.

**Request:**
```json
{
  "subscription": {
    "plan": "professional",
    "status": "active",
    "startDate": "2025-11-14T00:00:00.000Z",
    "endDate": "2026-11-14T00:00:00.000Z",
    "billingCycle": "yearly",
    "amount": 24000
  },
  "limits": {
    "maxBranches": 10,
    "maxUsers": 100,
    "maxMachines": 200
  }
}
```

**Response:**
```json
{
  "message": "Company updated successfully",
  "company": { ... }
}
```

---

### 6. Get Pending Subscriptions

**GET** `/master-admin/subscription/pending`

Returns all companies with pending subscription status.

**Response:**
```json
{
  "companies": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "companyName": "Pending Company",
      "email": "admin@pending.com",
      "subscription": {
        "plan": "professional",
        "status": "pending"
      },
      "primaryContact": {
        "name": "John Doe",
        "email": "john@pending.com"
      },
      "createdAt": "2025-11-14T00:00:00.000Z"
    }
  ],
  "total": 5
}
```

**Use Cases:**
- Onboarding workflow
- Activation queue
- Follow-up reminders
- Sales pipeline

---

### 7. Get Expiring Subscriptions

**GET** `/master-admin/subscription/expiring?days=30`

Returns companies with subscriptions expiring in the next N days.

**Query Parameters:**
- `days` (optional): Number of days to look ahead (default: 30)

**Response:**
```json
{
  "companies": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "companyName": "ABC Manufacturing",
      "email": "admin@abc.com",
      "subscription": {
        "plan": "professional",
        "status": "active",
        "endDate": "2025-12-15T00:00:00.000Z",
        "amount": 2000
      },
      "primaryContact": {
        "name": "John Doe",
        "email": "john@abc.com"
      }
    }
  ],
  "total": 3,
  "daysAhead": 30
}
```

**Use Cases:**
- Renewal reminders
- Retention campaigns
- Revenue forecasting
- Account management prioritization

---

### 8. Get Support Statistics

**GET** `/master-admin/support-stats?days=30&page=1&limit=50`

Returns support ticket statistics and recent tickets.

**Query Parameters:**
- `days` (optional): Time period in days (default: 30)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
```json
{
  "stats": {
    "byStatus": {
      "open": 15,
      "in_progress": 10,
      "pending_customer": 5,
      "resolved": 50,
      "closed": 100
    },
    "byPriority": {
      "low": 30,
      "medium": 80,
      "high": 60,
      "critical": 10
    },
    "byCategory": {
      "technical": 100,
      "billing": 20,
      "feature_request": 30,
      "bug_report": 20,
      "account": 10
    },
    "total": 180
  },
  "recentTickets": [
    {
      "_id": "507f1f77bcf86cd799439030",
      "ticketNumber": "TKT-2511-0001",
      "companyId": {
        "_id": "507f1f77bcf86cd799439011",
        "companyName": "ABC Manufacturing",
        "email": "admin@abc.com"
      },
      "subject": "Machine offline issue",
      "category": "technical",
      "priority": "high",
      "status": "in_progress",
      "reportedBy": {
        "name": "John Doe",
        "email": "john@abc.com",
        "role": "Manager"
      },
      "createdAt": "2025-11-14T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 180,
    "pages": 4
  },
  "period": {
    "days": 30,
    "startDate": "2025-10-15T00:00:00.000Z",
    "endDate": "2025-11-14T00:00:00.000Z"
  }
}
```

**Use Cases:**
- Support dashboard
- Team workload monitoring
- SLA compliance tracking
- Support trends analysis

---

### 9. Get Revenue Analytics

**GET** `/master-admin/revenue-analytics?months=12`

Returns revenue metrics, trends, and projections.

**Query Parameters:**
- `months` (optional): Historical period in months (default: 12)

**Response:**
```json
{
  "current": {
    "mrr": 80000,
    "arr": 960000,
    "totalRecurring": 960000
  },
  "historical": [
    {
      "_id": {
        "year": 2025,
        "month": 11
      },
      "revenue": 85000,
      "count": 45
    },
    {
      "_id": {
        "year": 2025,
        "month": 10
      },
      "revenue": 80000,
      "count": 42
    }
  ],
  "byPlan": [
    {
      "_id": "enterprise",
      "count": 5,
      "totalRevenue": 25000,
      "avgRevenue": 5000
    },
    {
      "_id": "professional",
      "count": 20,
      "totalRevenue": 40000,
      "avgRevenue": 2000
    },
    {
      "_id": "basic",
      "count": 15,
      "totalRevenue": 15000,
      "avgRevenue": 1000
    }
  ],
  "period": {
    "months": 12,
    "startDate": "2024-11-14T00:00:00.000Z",
    "endDate": "2025-11-14T00:00:00.000Z"
  }
}
```

**Key Metrics:**
- **MRR**: Monthly Recurring Revenue
- **ARR**: Annual Recurring Revenue
- **Historical Trends**: Month-over-month growth
- **Plan Distribution**: Revenue by subscription tier

---

## 📈 Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE_URL = 'https://your-api.com';
const MASTER_ADMIN_TOKEN = 'your-master-admin-token';

// Get subscription dashboard
async function getSubscriptionDashboard() {
  const response = await axios.get(
    `${API_BASE_URL}/master-admin/subscription-dashboard`,
    {
      headers: {
        'Authorization': `Bearer ${MASTER_ADMIN_TOKEN}`,
        'x-api-key': 'your-api-key'
      }
    }
  );
  return response.data;
}

// Get companies with filters
async function getCompanies(status = 'active', plan = null) {
  const params = { status };
  if (plan) params.plan = plan;

  const response = await axios.get(
    `${API_BASE_URL}/master-admin/companies`,
    {
      headers: {
        'Authorization': `Bearer ${MASTER_ADMIN_TOKEN}`,
        'x-api-key': 'your-api-key'
      },
      params
    }
  );
  return response.data;
}

// Get expiring subscriptions
async function getExpiringSubscriptions(days = 30) {
  const response = await axios.get(
    `${API_BASE_URL}/master-admin/subscription/expiring`,
    {
      headers: {
        'Authorization': `Bearer ${MASTER_ADMIN_TOKEN}`,
        'x-api-key': 'your-api-key'
      },
      params: { days }
    }
  );
  return response.data;
}

// Create new company
async function createCompany(companyData) {
  const response = await axios.post(
    `${API_BASE_URL}/master-admin/companies`,
    companyData,
    {
      headers: {
        'Authorization': `Bearer ${MASTER_ADMIN_TOKEN}`,
        'x-api-key': 'your-api-key',
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}
```

---

## 🎨 React Component Example

```javascript
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function SubscriptionDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(
        '/master-admin/subscription-dashboard',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'x-api-key': process.env.REACT_APP_API_KEY
          }
        }
      );
      setDashboard(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="subscription-dashboard">
      <h1>Subscription Management</h1>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="card">
          <h3>Total Companies</h3>
          <p className="metric">{dashboard.summary.totalCompanies}</p>
        </div>
        <div className="card">
          <h3>Active Subscriptions</h3>
          <p className="metric">{dashboard.summary.statusBreakdown.active}</p>
        </div>
        <div className="card">
          <h3>Pending Subscriptions</h3>
          <p className="metric">{dashboard.summary.statusBreakdown.pending}</p>
        </div>
        <div className="card">
          <h3>Total Branches</h3>
          <p className="metric">{dashboard.summary.totalBranches}</p>
        </div>
      </div>

      {/* Revenue Metrics */}
      <div className="revenue-section">
        <h2>Revenue</h2>
        <div className="revenue-cards">
          <div className="card">
            <h3>Monthly Recurring Revenue</h3>
            <p className="metric">
              ${dashboard.summary.revenue.monthlyRecurring.toLocaleString()}
            </p>
          </div>
          <div className="card">
            <h3>Annual Recurring Revenue</h3>
            <p className="metric">
              ${dashboard.summary.revenue.annualRecurring.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {dashboard.alerts.expiringSubscriptions > 0 && (
        <div className="alert warning">
          <h3>⚠️ Action Required</h3>
          <p>{dashboard.alerts.expiringSubscriptions} subscriptions expiring soon</p>
        </div>
      )}

      {/* Support Tickets */}
      <div className="support-section">
        <h2>Support Tickets</h2>
        <div className="ticket-stats">
          <div className="stat">
            <span className="label">Open:</span>
            <span className="value">{dashboard.summary.supportTickets.open}</span>
          </div>
          <div className="stat">
            <span className="label">In Progress:</span>
            <span className="value">{dashboard.summary.supportTickets.in_progress}</span>
          </div>
          <div className="stat">
            <span className="label">Resolved:</span>
            <span className="value">{dashboard.summary.supportTickets.resolved}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionDashboard;
```

---

## 🔐 Security & Access Control

### Authorization
- **Master Admin Only**: All endpoints require Master Admin authentication
- **JWT Token**: Valid token must be provided in Authorization header
- **API Key**: x-api-key header required for all requests

### Permissions Required
- `view_all_branches` - View company branches
- `manage_users` - Create and update companies
- `view_financial_reports` - Access revenue analytics
- `view_analytics` - Access dashboard and statistics

---

## 📝 Data Models

### Company Model

```javascript
{
  companyName: String,
  companyCode: String (unique),
  email: String (unique),
  phone: String,
  address: {
    street, city, state, country, zipCode
  },
  subscription: {
    plan: enum ['trial', 'basic', 'professional', 'enterprise', 'custom'],
    status: enum ['active', 'pending', 'suspended', 'cancelled', 'expired'],
    startDate: Date,
    endDate: Date,
    trialEndDate: Date,
    billingCycle: enum ['monthly', 'yearly'],
    amount: Number,
    currency: String
  },
  limits: {
    maxBranches, maxUsers, maxMachines, maxOrders, maxStorageGB
  },
  usage: {
    branches, users, machines, orders, storageGB
  },
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Support Ticket Model

```javascript
{
  ticketNumber: String (unique),
  companyId: ObjectId,
  branchId: ObjectId,
  subject: String,
  description: String,
  category: enum ['technical', 'billing', 'feature_request', 'bug_report', 'account', 'training', 'other'],
  priority: enum ['low', 'medium', 'high', 'critical'],
  status: enum ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'],
  reportedBy: {
    name, email, phone, role, userId
  },
  assignedTo: ObjectId,
  resolution: String,
  resolvedAt: Date,
  sla: {
    responseTime: Number,
    resolutionTime: Number,
    breached: Boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 Deployment Notes

1. **Environment Variables:**
   ```bash
   MONGO_URI=mongodb://...
   JWT_SECRET=your-secure-secret
   API_KEY=your-api-key
   ```

2. **Database Indexes:**
   - Company: `companyCode`, `email`, `subscription.status`
   - SupportTicket: `ticketNumber`, `companyId`, `status`

3. **Performance:**
   - All dashboard queries use parallel execution
   - Indexes ensure fast lookups
   - Pagination prevents memory issues

---

## 📊 Complete Endpoint List

### Subscription Management (9 endpoints)
- `GET /master-admin/subscription-dashboard` - Overview
- `GET /master-admin/companies` - List companies
- `GET /master-admin/companies/{id}` - Company details
- `POST /master-admin/companies` - Create company
- `PUT /master-admin/companies/{id}` - Update company
- `GET /master-admin/subscription/pending` - Pending subscriptions
- `GET /master-admin/subscription/expiring` - Expiring subscriptions
- `GET /master-admin/support-stats` - Support statistics
- `GET /master-admin/revenue-analytics` - Revenue analytics

---

## 🎯 Best Practices

### For Master Admins

1. **Regular Monitoring**
   - Check dashboard daily
   - Review expiring subscriptions weekly
   - Monitor support ticket trends

2. **Proactive Management**
   - Contact companies with expiring subscriptions
   - Follow up on pending subscriptions
   - Address suspended accounts promptly

3. **Revenue Optimization**
   - Analyze plan distribution
   - Identify upsell opportunities
   - Track MRR/ARR trends

### For Developers

1. **Error Handling**
   - Always handle API errors gracefully
   - Display user-friendly error messages
   - Log errors for debugging

2. **Performance**
   - Use pagination for large datasets
   - Cache dashboard data appropriately
   - Implement loading states

3. **Security**
   - Never expose tokens in client code
   - Validate all user inputs
   - Use HTTPS in production

---

**Last Updated:** November 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
