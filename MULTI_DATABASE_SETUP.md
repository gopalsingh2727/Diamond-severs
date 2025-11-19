# Multi-Database Connection Setup

This guide explains how to use separate MongoDB databases for MasterAdmin operations and regular operations while sharing the same model schemas.

## 📋 Overview

The system now supports **multiple database connections**:

- **Main Database**: For regular operations (Branch, Customer, Order, Machine, etc.)
- **MasterAdmin Database**: For MasterAdmin operations (separate for security/isolation)

Both databases can use the **same model schemas** but store data in completely separate databases.

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Lambda Handlers                 │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────┐    ┌──────────────┐
│   Main   │    │ MasterAdmin  │
│   DB     │    │     DB       │
└──────────┘    └──────────────┘
```

## 📁 File Structure

```
config/mongodb/
├── db.js              # Legacy single connection (deprecated)
├── connections.js     # NEW: Multiple connection manager
└── modelFactory.js    # NEW: Model factory for different connections
```

## 🚀 Quick Start

### 1. Environment Variables

Add to your `.env` file:

```bash
# Main Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/main-database?retryWrites=true&w=majority

# MasterAdmin Database (separate database)
MASTER_ADMIN_MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/masteradmin-database?retryWrites=true&w=majority
```

**Note**: If `MASTER_ADMIN_MONGO_URI` is not set, it will fall back to `MONGO_URI` (same database).

### 2. Using in Lambda Handlers

#### Example 1: Regular Operations (Main Database)

```javascript
// handlers/Branch/getBranches.js
const { getMainConnection } = require('../../config/mongodb/connections');

exports.handler = async (event) => {
  try {
    // Connect to main database
    const connection = await getMainConnection();

    // Get Branch model from main database
    const Branch = connection.models.Branch ||
                   connection.model('Branch', require('../../models/Branch/Branch').schema);

    // Use the model
    const branches = await Branch.find({});

    return {
      statusCode: 200,
      body: JSON.stringify({ data: branches })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

#### Example 2: MasterAdmin Operations (MasterAdmin Database)

```javascript
// handlers/MasterAdmin/getMasterAdmins.js
const { getMasterAdminConnection } = require('../../config/mongodb/connections');

exports.handler = async (event) => {
  try {
    // Connect to MasterAdmin database
    const connection = await getMasterAdminConnection();

    // Get MasterAdmin model from masteradmin database
    const MasterAdmin = connection.models.MasterAdmin ||
                        connection.model('MasterAdmin', require('../../models/masterAdmin/masterAdmin').schema);

    // Use the model
    const admins = await MasterAdmin.find({});

    return {
      statusCode: 200,
      body: JSON.stringify({ data: admins })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

#### Example 3: Using Model Factory (Recommended)

```javascript
// handlers/MasterAdmin/dashboard.js
const { getModel } = require('../../config/mongodb/modelFactory');

exports.handler = async (event) => {
  try {
    // Get models from appropriate databases
    const MasterAdmin = await getModel('MasterAdmin', 'masteradmin');
    const Branch = await getModel('Branch', 'main');
    const Order = await getModel('Order', 'main');

    // Use the models
    const totalAdmins = await MasterAdmin.countDocuments({});
    const totalBranches = await Branch.countDocuments({});
    const totalOrders = await Order.countDocuments({});

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: {
          totalAdmins,
          totalBranches,
          totalOrders
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

## 🔧 Advanced Usage

### Getting Multiple Models at Once

```javascript
const { getModels } = require('../../config/mongodb/modelFactory');

// Get multiple models from main database
const { Branch, Customer, Machine } = await getModels(
  ['Branch', 'Customer', 'Machine'],
  'main'
);

// Get multiple models from masteradmin database
const { MasterAdmin, Admin } = await getModels(
  ['MasterAdmin', 'Admin'],
  'masteradmin'
);
```

### Using Different Connections Dynamically

```javascript
const { getConnection } = require('../../config/mongodb/connections');

const connectionType = event.headers['x-user-role'] === 'master_admin'
  ? 'masteradmin'
  : 'main';

const connection = await getConnection(connectionType);
```

### Cross-Database Operations

```javascript
const { getMainConnection, getMasterAdminConnection } = require('../../config/mongodb/connections');

exports.handler = async (event) => {
  try {
    // Connect to both databases
    const mainDb = await getMainConnection();
    const masterAdminDb = await getMasterAdminConnection();

    // Get models from different databases
    const Branch = mainDb.model('Branch', require('../../models/Branch/Branch').schema);
    const MasterAdmin = masterAdminDb.model('MasterAdmin', require('../../models/masterAdmin/masterAdmin').schema);

    // Perform operations on both databases
    const branches = await Branch.find({});
    const masterAdmin = await MasterAdmin.findById(event.requestContext.authorizer.userId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        masterAdmin: masterAdmin.fullName,
        totalBranches: branches.length
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

## 📝 Migrating Existing Models

### Current Pattern (Single Connection)

```javascript
// models/Branch/Branch.js
const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  name: String,
  location: String
});

module.exports = mongoose.model('Branch', BranchSchema);
```

### Recommended Pattern (Multi-Connection Support)

```javascript
// models/Branch/Branch.js
const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  name: String,
  location: String
});

// Export schema for multi-connection support
module.exports.schema = BranchSchema;

// Export model for backward compatibility (uses default connection)
module.exports = mongoose.models.Branch || mongoose.model('Branch', BranchSchema);
```

## 🎯 Best Practices

### 1. **Connection Reuse**
Connections are cached and reused across Lambda invocations. Don't worry about reconnecting on every request.

### 2. **Database Separation Strategy**

- **Main Database**: Store all business data (branches, orders, customers, machines)
- **MasterAdmin Database**: Store only master admin related data for security isolation

### 3. **Model Organization**

Add new models to `modelFactory.js`:

```javascript
const MODEL_SCHEMAS = {
  'YourNewModel': () => require('../../models/YourNewModel/YourNewModel'),
  // ... other models
};
```

### 4. **Error Handling**

Always wrap database operations in try-catch blocks:

```javascript
try {
  const connection = await getMainConnection();
  // ... operations
} catch (error) {
  console.error('Database error:', error);
  // Handle error appropriately
}
```

### 5. **Testing**

Test with both connections:

```javascript
// Test with main database
const Branch = await getModel('Branch', 'main');
await Branch.create({ name: 'Test Branch' });

// Test with masteradmin database
const MasterAdmin = await getModel('MasterAdmin', 'masteradmin');
await MasterAdmin.create({ username: 'test' });
```

## 🔍 Connection States

Monitor connection status:

```javascript
const { getMainConnection } = require('../../config/mongodb/connections');

const connection = await getMainConnection();

console.log('Connection state:', connection.readyState);
// 0 = disconnected
// 1 = connected
// 2 = connecting
// 3 = disconnecting
```

## 🛠️ Troubleshooting

### Issue: Models not found in registry

**Solution**: Add the model to `MODEL_SCHEMAS` in `modelFactory.js`

```javascript
const MODEL_SCHEMAS = {
  'YourModel': () => require('../../models/YourModel/YourModel'),
};
```

### Issue: Connection timeout

**Solution**: Check your connection string and network access:

1. Verify MongoDB Atlas network access (IP whitelist)
2. Check connection string format
3. Verify credentials

### Issue: Using old connection pattern

**Solution**: Gradually migrate from `require('../../config/mongodb/db')` to:

```javascript
const { getMainConnection } = require('../../config/mongodb/connections');
```

## 📊 Monitoring

Log connection status:

```javascript
const { getMainConnection, getMasterAdminConnection } = require('../../config/mongodb/connections');

exports.handler = async (event) => {
  const mainDb = await getMainConnection();
  const masterAdminDb = await getMasterAdminConnection();

  console.log('Main DB:', mainDb.readyState === 1 ? 'Connected' : 'Disconnected');
  console.log('MasterAdmin DB:', masterAdminDb.readyState === 1 ? 'Connected' : 'Disconnected');
};
```

## 🚀 Next Steps

1. ✅ Set `MASTER_ADMIN_MONGO_URI` in your `.env` file
2. ✅ Update handlers to use the new connection methods
3. ✅ Test with both databases
4. ✅ Monitor connection logs in CloudWatch
5. ✅ Update serverless.yml to include the new environment variable

## 📚 Related Files

- [connections.js](./config/mongodb/connections.js) - Connection manager
- [modelFactory.js](./config/mongodb/modelFactory.js) - Model factory
- [.env.example](./.env.example) - Environment variables reference
- [CLAUDE.md](./CLAUDE.md) - Project documentation

## ⚠️ Important Notes

1. **Connection Pooling**: Each connection maintains its own pool (max 50 connections)
2. **Lambda Cold Starts**: First invocation will create connections (slower)
3. **Warm Invocations**: Subsequent invocations reuse connections (faster)
4. **Memory Usage**: Each connection uses additional memory (~50MB)
5. **Cost Impact**: Minimal - mainly during cold starts

## 🎓 Example: Complete Handler Migration

### Before (Single Connection)

```javascript
const connectDB = require('../../config/mongodb/db');
const Branch = require('../../models/Branch/Branch');

exports.handler = async (event) => {
  await connectDB();
  const branches = await Branch.find({});
  return {
    statusCode: 200,
    body: JSON.stringify({ data: branches })
  };
};
```

### After (Multi-Connection)

```javascript
const { getModel } = require('../../config/mongodb/modelFactory');

exports.handler = async (event) => {
  const Branch = await getModel('Branch', 'main');
  const branches = await Branch.find({});
  return {
    statusCode: 200,
    body: JSON.stringify({ data: branches })
  };
};
```

---

**Last Updated**: 2025-11-15
**Version**: 1.0.0
**Author**: 27 Manufacturing System Team
