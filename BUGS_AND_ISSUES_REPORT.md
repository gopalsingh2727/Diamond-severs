# 🐛 BUGS AND ISSUES REPORT

**Project:** 27 Manufacturing Management System
**Date:** November 2025
**Total Issues:** 30+

---

## 🚨 CRITICAL ISSUES (Must Fix Immediately)

### 1. **EXPOSED CREDENTIALS IN CODE**
**Severity:** 🔴 CRITICAL
**Files:**
- `serverless.yml:34-36`
- `.env`

**Issue:**
```yaml
MONGO_URI: 'mongodb+srv://27shopgopal:S3kYB9MgKHPpaBjJ@cluster0...'
API_KEY: 27infinity.in_5f84c89315f74a2db149c06a93cf4820
JWT_SECRET: yourSecr33232
```

**Impact:** Complete system compromise, unauthorized database access

**Fix:**
```yaml
# Use AWS Secrets Manager or environment variables
MONGO_URI: ${ssm:/production/mongodb/uri}
API_KEY: ${ssm:/production/api/key}
JWT_SECRET: ${ssm:/production/jwt/secret}
```

---

### 2. **WEAK JWT SECRET**
**Severity:** 🔴 CRITICAL
**File:** `serverless.yml:36`

**Issue:** JWT secret is `yourSecr33232` - too weak

**Fix:**
```bash
# Generate strong secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Use the generated secret (minimum 32 characters)
JWT_SECRET: "a3f5b8c2d9e1f4g7h0i3j6k9l2m5n8o1p4q7r0s3t6u9v2w5x8y1z4a7b0c3d6e9"
```

---

### 3. **DATABASE CONNECTION RACE CONDITION**
**Severity:** 🔴 CRITICAL
**File:** `config/mongodb/db.js:31-72`

**Issue:** Double `resolve()` calls causing race condition

**Current Code:**
```javascript
mongoose.connection.once('open', () => {
  cached.promise = Promise.resolve(mongoose);
  resolve(); // Line 45 ❌
});

// ...

if (cached.conn) {
  resolve(); // Line 62 ❌ DUPLICATE
}
```

**Fix:**
```javascript
// config/mongodb/db.js
const mongoose = require('mongoose');

let isConnected = false;

const connect = async () => {
  if (isConnected) {
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = db.connections[0].readyState === 1;
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

module.exports = connect;
```

---

### 4. **UNDEFINED MODEL REFERENCE**
**Severity:** 🔴 CRITICAL
**File:** `handlers/oders/oders.js:208`

**Issue:**
```javascript
const operator = await User.findById(machineData.operatorId);
// ❌ 'User' is not defined - causes crash
```

**Fix:**
```javascript
const Operator = require('../../models/MachineOperator/MachineOperator');
const operator = await Operator.findById(machineData.operatorId);
```

---

### 5. **NOSQL INJECTION VULNERABILITY**
**Severity:** 🔴 CRITICAL
**Files:** Multiple handlers

**Issue:** No input sanitization before database queries

**Current Code:**
```javascript
const data = JSON.parse(event.body);
const order = await Order.findById(data.orderId); // ❌ Vulnerable
```

**Fix:**
```javascript
const mongoose = require('mongoose');

// Add validation
if (!mongoose.Types.ObjectId.isValid(data.orderId)) {
  return respond(400, { message: 'Invalid order ID' });
}

const order = await Order.findById(data.orderId);
```

---

### 6. **RACE CONDITION IN ORDER ID GENERATION**
**Severity:** 🔴 CRITICAL
**File:** `models/oders/oders.js:213-241`

**Issue:** Non-atomic order ID generation

**Current Code:**
```javascript
const count = await mongoose.model('Order').countDocuments({...});
this.orderId = `ORD-${branchCode}-${yyyyMMdd}-${(count + 1).toString().padStart(3, '0')}`;
```

**Fix:**
```javascript
// Use MongoDB sequence or atomic counter
orderSchema.statics.generateOrderId = async function(branchId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const Counter = mongoose.model('Counter');
    const counter = await Counter.findOneAndUpdate(
      { _id: 'orderId', branchId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );

    const branch = await Branch.findById(branchId).session(session);
    const branchCode = branch.branchCode || 'DEF';
    const date = new Date();
    const yyyyMMdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    const orderId = `ORD-${branchCode}-${yyyyMMdd}-${String(counter.seq).padStart(3, '0')}`;

    await session.commitTransaction();
    return orderId;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Create Counter model
const counterSchema = new mongoose.Schema({
  _id: String,
  branchId: mongoose.Schema.Types.ObjectId,
  seq: { type: Number, default: 0 }
});
mongoose.model('Counter', counterSchema);
```

---

### 7. **MISSING RATE LIMITING**
**Severity:** 🔴 CRITICAL
**All Files:** All handlers

**Issue:** No rate limiting allows brute force attacks

**Fix:**
```javascript
// middleware/rateLimiter.js
const { cache } = require('../config/redis/redis');

const rateLimiter = (options = {}) => {
  const {
    windowMs = 60000, // 1 minute
    maxRequests = 100,
    keyPrefix = 'rate_limit'
  } = options;

  return async (event) => {
    const ip = event.headers['X-Forwarded-For'] || event.requestContext?.identity?.sourceIp;
    const key = `${keyPrefix}:${ip}`;

    const current = await cache.get(key) || 0;

    if (current >= maxRequests) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          message: 'Too many requests, please try again later'
        })
      };
    }

    await cache.set(key, current + 1, Math.floor(windowMs / 1000));
    return null; // Continue
  };
};

module.exports = rateLimiter;
```

---

## ⚠️ HIGH SEVERITY ISSUES

### 8. **OVERLY PERMISSIVE CORS**
**Severity:** 🟠 HIGH
**File:** `utiles/withCors.js:2`

**Issue:**
```javascript
'Access-Control-Allow-Origin': '*', // ❌ Allows all origins
```

**Fix:**
```javascript
const allowedOrigins = [
  'https://yourdomain.com',
  'https://app.yourdomain.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
].filter(Boolean);

const origin = event.headers.origin || event.headers.Origin;

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};
```

---

### 9. **PLAINTEXT PIN COMPARISON**
**Severity:** 🟠 HIGH
**File:** `handlers/MachineOperator/MachineOperator.js:66-75`

**Issue:** PIN checked in plaintext before hashing

**Current Code:**
```javascript
const existingPinInBranch = await Operator.findOne({
  pin: pin,  // ❌ Plain text comparison
  branchId: branchId
});
```

**Fix:**
```javascript
// Check all operators in branch and compare hashed PINs
const operators = await Operator.find({ branchId });

for (const op of operators) {
  const isMatch = await bcrypt.compare(pin, op.pin);
  if (isMatch) {
    return respond(400, {
      message: 'This PIN is already used by another operator in this branch.'
    });
  }
}
```

---

### 10. **MISSING INPUT SANITIZATION**
**Severity:** 🟠 HIGH
**Files:** All handlers

**Issue:** User input not sanitized

**Fix:**
```javascript
// middleware/sanitize.js
const sanitize = (data) => {
  if (typeof data === 'string') {
    return data
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .trim();
  }

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const key in data) {
      sanitized[key] = sanitize(data[key]);
    }
    return sanitized;
  }

  return data;
};

module.exports = sanitize;

// Usage in handlers
const sanitize = require('../../middleware/sanitize');
const data = sanitize(JSON.parse(event.body));
```

---

### 11. **NO FILE SIZE LIMIT**
**Severity:** 🟠 HIGH
**File:** `handlers/Customer/customer.js:246-279`

**Issue:** File uploads have no size limit

**Fix:**
```javascript
// Check file size before upload
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

if (file.content.length > MAX_FILE_SIZE) {
  return respond(400, {
    message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
  });
}

// Validate file type
const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
if (!allowedTypes.includes(file.mimetype)) {
  return respond(400, {
    message: 'Invalid file type. Only JPEG and PNG allowed'
  });
}
```

---

## 🟡 MEDIUM SEVERITY ISSUES

### 12. **WEAK PASSWORD POLICY**
**Severity:** 🟡 MEDIUM
**File:** `handlers/MachineOperator/MachineOperator.js:54-57`

**Issue:** Only 4-digit PIN required

**Fix:**
```javascript
// Increase to 6 digits minimum
if (!/^\d{6,8}$/.test(pin)) {
  return respond(400, { message: 'PIN must be 6-8 digits' });
}

// Add PIN complexity check
const pinDigits = pin.split('');
const allSame = pinDigits.every(d => d === pinDigits[0]);
const sequential = pinDigits.every((d, i) => i === 0 || parseInt(d) === parseInt(pinDigits[i-1]) + 1);

if (allSame || sequential) {
  return respond(400, {
    message: 'PIN too simple. Avoid sequential or repeated digits'
  });
}
```

---

### 13. **MISSING UNIQUE CONSTRAINT**
**Severity:** 🟡 MEDIUM
**File:** `models/MachineOperator/MachineOperator.js:16`

**Issue:**
```javascript
operatorSchema.index({ pin: 1, branchId: 1 }, { unique: false }); // ❌
```

**Fix:**
```javascript
operatorSchema.index({ pin: 1, branchId: 1 }, { unique: true }); // ✅
```

---

### 14. **INCONSISTENT ERROR RESPONSES**
**Severity:** 🟡 MEDIUM
**Files:** Multiple handlers

**Issue:** Different error formats

**Fix:**
```javascript
// utiles/responses.js
const standardResponse = (statusCode, data, error = null) => {
  const body = {
    success: statusCode >= 200 && statusCode < 300,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    body.error = {
      message: error.message || error,
      code: error.code,
    };

    if (process.env.NODE_ENV === 'development') {
      body.error.stack = error.stack;
    }
  } else {
    body.data = data;
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
};

module.exports = { standardResponse };
```

---

### 15. **NO TRANSACTION SUPPORT**
**Severity:** 🟡 MEDIUM
**File:** `handlers/oders/oders.js`

**Issue:** Multi-step operations without transactions

**Fix:**
```javascript
// Use MongoDB transactions for critical operations
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Create order
  const order = new Order(orderData);
  await order.save({ session });

  // Update machine
  await Machine.findByIdAndUpdate(
    machineId,
    { $inc: { currentLoad: 1 } },
    { session }
  );

  // Update customer
  await Customer.findByIdAndUpdate(
    customerId,
    { $inc: { totalOrders: 1 } },
    { session }
  );

  await session.commitTransaction();
  return respond(201, { order });
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

### 16. **MISSING EMAIL VALIDATION**
**Severity:** 🟡 MEDIUM
**File:** `handlers/Customer/customer.js:204-224`

**Issue:** Email not validated

**Fix:**
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (email && !emailRegex.test(email)) {
  return respond(400, { message: 'Invalid email format' });
}

// Also validate phone
const phoneRegex = /^\+?[\d\s-]{10,}$/;
if (contactNumber && !phoneRegex.test(contactNumber)) {
  return respond(400, { message: 'Invalid phone number format' });
}
```

---

### 17. **EXPOSED SENSITIVE LOGS**
**Severity:** 🟡 MEDIUM
**Files:** Multiple handlers

**Issue:**
```javascript
console.log("User from token:", user); // ❌ Logs sensitive data
console.log("Received data:", data);   // ❌ Logs PII
```

**Fix:**
```javascript
// Use structured logging without sensitive data
logger.info('User authenticated', {
  userId: user.id,
  role: user.role
  // Don't log: token, password, pin, email, etc.
});

logger.debug('Request received', {
  method: event.httpMethod,
  path: event.path,
  // Don't log: full body, headers with tokens
});
```

---

### 18. **NO PAGINATION LIMITS**
**Severity:** 🟡 MEDIUM
**File:** `handlers/Customer/customer.js:362`

**Issue:**
```javascript
const customers = await Customer.find(filter).sort({ createdAt: -1 });
// ❌ Can return thousands of records
```

**Fix:**
```javascript
const page = parseInt(event.queryStringParameters?.page || '1');
const limit = Math.min(parseInt(event.queryStringParameters?.limit || '50'), 100);
const skip = (page - 1) * limit;

const [customers, total] = await Promise.all([
  Customer.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean(),
  Customer.countDocuments(filter)
]);

return respond(200, {
  customers,
  pagination: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit)
  }
});
```

---

### 19. **NO AUDIT TRAIL**
**Severity:** 🟡 MEDIUM
**All Files**

**Issue:** No logging of sensitive operations

**Fix:**
```javascript
// models/auditLog.js
const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  changes: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);

// Usage
await AuditLog.create({
  userId: user.id,
  action: 'DELETE',
  resourceType: 'Order',
  resourceId: orderId,
  changes: { status: 'deleted' },
  ipAddress: event.headers['X-Forwarded-For'],
  userAgent: event.headers['User-Agent']
});
```

---

## 📝 CODE QUALITY ISSUES

### 20. **DEPRECATED MONGOOSE OPTIONS**
**Severity:** 🟢 LOW
**File:** `config/mongodb/db.js:16-17`

**Issue:**
```javascript
useNewUrlParser: true,      // ❌ Deprecated
useUnifiedTopology: true,   // ❌ Deprecated
```

**Fix:** Remove these options (they're default in Mongoose 6+)

---

## 🛠️ QUICK FIXES CHECKLIST

### Immediate (Today)
- [ ] Rotate all credentials
- [ ] Remove .env from git
- [ ] Fix database connection bug
- [ ] Fix undefined User model reference
- [ ] Add rate limiting

### This Week
- [ ] Implement input sanitization
- [ ] Fix CORS policy
- [ ] Add transaction support
- [ ] Implement proper error handling
- [ ] Add audit logging

### This Month
- [ ] Implement comprehensive validation
- [ ] Add automated security scanning
- [ ] Performance optimization
- [ ] Add comprehensive tests
- [ ] Security audit

---

## 🔒 SECURITY BEST PRACTICES

1. **Never commit .env files**
   ```bash
   # Add to .gitignore
   .env
   .env.*
   !.env.example
   ```

2. **Use AWS Secrets Manager**
   ```bash
   aws secretsmanager create-secret \
     --name production/mongodb/uri \
     --secret-string "your-connection-string"
   ```

3. **Enable CloudWatch Alarms**
   - Set up alarms for error rates
   - Monitor failed authentication attempts
   - Track unusual API usage patterns

4. **Regular Security Updates**
   ```bash
   npm audit
   npm audit fix
   ```

5. **Implement Security Headers**
   ```javascript
   headers: {
     'X-Content-Type-Options': 'nosniff',
     'X-Frame-Options': 'DENY',
     'X-XSS-Protection': '1; mode=block',
     'Strict-Transport-Security': 'max-age=31536000'
   }
   ```

---

## 📞 Need Help?

For critical security issues, contact your security team immediately.

**Report Generated:** November 2025
**Next Review:** Schedule monthly security audits
