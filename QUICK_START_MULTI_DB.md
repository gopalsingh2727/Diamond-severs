# Quick Start: Multi-Database Setup

## ⚡ 5-Minute Setup Guide

### Step 1: Add Environment Variable

Add this line to your `.env` file:

```bash
MASTER_ADMIN_MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/masteradmin-db?retryWrites=true&w=majority
```

Or use the same database (not recommended for production):

```bash
# Leave this commented out to use MONGO_URI for both
# MASTER_ADMIN_MONGO_URI=
```

---

### Step 2: Update Your Handler

**Before:**
```javascript
const connectDB = require('../../config/mongodb/db');
const Branch = require('../../models/Branch/Branch');

exports.handler = async (event) => {
  await connectDB();
  const branches = await Branch.find({});
  // ...
};
```

**After (Option A - Simple):**
```javascript
const { getMainConnection } = require('../../config/mongodb/connections');

exports.handler = async (event) => {
  const db = await getMainConnection();
  const Branch = db.model('Branch', require('../../models/Branch/Branch').schema);
  const branches = await Branch.find({});
  // ...
};
```

**After (Option B - Model Factory - Recommended):**
```javascript
const { getModel } = require('../../config/mongodb/modelFactory');

exports.handler = async (event) => {
  const Branch = await getModel('Branch', 'main');
  const branches = await Branch.find({});
  // ...
};
```

---

### Step 3: For MasterAdmin Operations

```javascript
const { getModel } = require('../../config/mongodb/modelFactory');

exports.handler = async (event) => {
  // This will use MASTER_ADMIN_MONGO_URI
  const MasterAdmin = await getModel('MasterAdmin', 'masteradmin');
  const admins = await MasterAdmin.find({});
  // ...
};
```

---

## 📋 Cheat Sheet

### Get Connections

```javascript
const { getMainConnection, getMasterAdminConnection } = require('../../config/mongodb/connections');

const mainDb = await getMainConnection();        // For regular data
const masterDb = await getMasterAdminConnection(); // For MasterAdmin data
```

### Get Models

```javascript
const { getModel } = require('../../config/mongodb/modelFactory');

// From main database
const Branch = await getModel('Branch', 'main');
const Order = await getModel('Order', 'main');
const Machine = await getModel('Machine', 'main');

// From masteradmin database
const MasterAdmin = await getModel('MasterAdmin', 'masteradmin');
```

### Get Multiple Models

```javascript
const { getModels } = require('../../config/mongodb/modelFactory');

const { Branch, Order, Machine } = await getModels(
  ['Branch', 'Order', 'Machine'],
  'main'
);
```

---

## 🎯 Which Database to Use?

| Model Type | Database | Connection Type |
|------------|----------|-----------------|
| MasterAdmin | MasterAdmin DB | `'masteradmin'` |
| Admin | Main DB | `'main'` |
| Manager | Main DB | `'main'` |
| Branch | Main DB | `'main'` |
| Customer | Main DB | `'main'` |
| Order | Main DB | `'main'` |
| Machine | Main DB | `'main'` |
| Product | Main DB | `'main'` |
| Material | Main DB | `'main'` |

---

## 🚀 Migration Checklist

- [ ] Add `MASTER_ADMIN_MONGO_URI` to `.env`
- [ ] Update serverless.yml environment variables
- [ ] Test connection with main database
- [ ] Test connection with masteradmin database
- [ ] Update MasterAdmin handlers to use `'masteradmin'` connection
- [ ] Update other handlers to use `'main'` connection
- [ ] Test all endpoints
- [ ] Deploy to AWS Lambda

---

## 🔍 Testing

### Test Main Database Connection

```javascript
const { getMainConnection } = require('./config/mongodb/connections');

async function testMain() {
  try {
    const db = await getMainConnection();
    console.log('✅ Main DB connected:', db.readyState === 1);
  } catch (error) {
    console.error('❌ Main DB error:', error);
  }
}

testMain();
```

### Test MasterAdmin Database Connection

```javascript
const { getMasterAdminConnection } = require('./config/mongodb/connections');

async function testMasterAdmin() {
  try {
    const db = await getMasterAdminConnection();
    console.log('✅ MasterAdmin DB connected:', db.readyState === 1);
  } catch (error) {
    console.error('❌ MasterAdmin DB error:', error);
  }
}

testMasterAdmin();
```

---

## ⚠️ Common Mistakes

### ❌ DON'T: Use default mongoose connection
```javascript
const mongoose = require('mongoose');
await mongoose.connect(process.env.MONGO_URI); // Wrong!
```

### ✅ DO: Use connection manager
```javascript
const { getMainConnection } = require('./config/mongodb/connections');
const db = await getMainConnection(); // Correct!
```

---

### ❌ DON'T: Import model directly
```javascript
const Branch = require('./models/Branch/Branch'); // Old way
```

### ✅ DO: Use model factory
```javascript
const { getModel } = require('./config/mongodb/modelFactory');
const Branch = await getModel('Branch', 'main'); // New way
```

---

## 📚 Full Documentation

For detailed documentation, see:
- [MULTI_DATABASE_SETUP.md](./MULTI_DATABASE_SETUP.md) - Complete guide
- [examples/multiConnectionExample.js](./examples/multiConnectionExample.js) - Code examples

---

## 🆘 Need Help?

1. Check CloudWatch logs for connection errors
2. Verify MongoDB Atlas network access (IP whitelist)
3. Test connection strings with MongoDB Compass
4. Ensure credentials are correct

---

**Setup Time**: ~5 minutes
**Difficulty**: Easy
**Impact**: High (Better security, scalability, and data isolation)
