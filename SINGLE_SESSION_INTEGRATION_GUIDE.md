# Single Session Enforcement Integration Guide
## Auto-Logout Previous Sessions When User Logs In

---

## 📋 Overview

This feature ensures **only ONE active session per user**. When a manager logs in on their office laptop, their home PC session is **automatically logged out**.

### Use Case Example:
1. Manager logs in at home on personal PC ✅
2. Manager goes to office, logs in on office laptop ✅
3. **Home PC is automatically logged out** ✅
4. Manager continues working on office laptop ✅

---

## 🎯 How It Works

```
User Login Flow:
┌─────────────────┐
│ User logs in    │
│ (Office Laptop) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Backend creates JWT     │
│ + enforces single       │
│ session                 │
└────────┬────────────────┘
         │
         ├──────────────────────┐
         │                      │
         ▼                      ▼
┌────────────────────┐  ┌────────────────────┐
│ Find old sessions  │  │ Create new session │
│ (Home PC)          │  │ (Office Laptop)    │
└────────┬───────────┘  └────────────────────┘
         │
         ▼
┌────────────────────────┐
│ Send "force_logout"    │
│ via WebSocket          │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ Home PC receives       │
│ message → auto logout  │
└────────────────────────┘
```

---

## 🔧 Integration Steps

### Step 1: Import Session Manager in Login Handlers

Add this import to your login handlers:

```javascript
// handlers/Manager/Manager.js
// handlers/Admin/Admin.js
// handlers/MasterAdmin/MasterAdmin.js

const { enforceSingleSession } = require('../../services/websocket/sessionManager');
```

---

### Step 2: Call enforceSingleSession After Successful Login

#### Example: Manager Login

```javascript
// handlers/Manager/Manager.js

module.exports.managerLogin = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);

    // 1. Validate credentials
    const manager = await Manager.findOne({ email });

    if (!manager || !await bcrypt.compare(password, manager.password)) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    // 2. Generate JWT token
    const token = jwt.sign(
      {
        userId: manager._id,
        role: 'manager',
        branchId: manager.branchId
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 3. 🔒 ENFORCE SINGLE SESSION - Terminate all existing sessions
    try {
      const result = await enforceSingleSession(
        manager._id.toString(),  // userId
        'Manager',               // userModel
        null                     // excludeConnectionId (null = terminate all)
      );

      console.log(`✅ Single session enforced: ${result.terminated} session(s) terminated`);
    } catch (error) {
      // Don't fail login if session enforcement fails
      console.error('⚠️ Error enforcing single session:', error);
    }

    // 4. Return success response
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'Login successful',
        token,
        user: {
          _id: manager._id,
          name: manager.name,
          email: manager.email,
          role: 'manager',
          branchId: manager.branchId
        }
      })
    };

  } catch (error) {
    console.error('❌ Login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
```

---

#### Example: Admin Login

```javascript
// handlers/Admin/Admin.js

module.exports.adminLogin = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);

    const admin = await Admin.findOne({ email });

    if (!admin || !await bcrypt.compare(password, admin.password)) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    const token = jwt.sign(
      {
        userId: admin._id,
        role: 'admin',
        branchId: admin.branchId
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 🔒 ENFORCE SINGLE SESSION
    try {
      await enforceSingleSession(admin._id.toString(), 'Admin', null);
    } catch (error) {
      console.error('⚠️ Error enforcing single session:', error);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'Login successful',
        token,
        user: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: 'admin',
          branchId: admin.branchId
        }
      })
    };

  } catch (error) {
    console.error('❌ Login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
```

---

#### Example: Machine Operator Login (PIN-based)

```javascript
// handlers/mobile/operatorMobile.js

module.exports.operatorLogin = async (event) => {
  try {
    const { pin, machineId } = JSON.parse(event.body);

    const operator = await MachineOperator.findOne({ pin });

    if (!operator) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid PIN' })
      };
    }

    const token = jwt.sign(
      {
        userId: operator._id,
        role: 'operator',
        machineId,
        branchId: operator.branchId
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    // 🔒 ENFORCE SINGLE SESSION
    // Operators should only be logged in on ONE machine at a time
    try {
      await enforceSingleSession(operator._id.toString(), 'MachineOperator', null);
    } catch (error) {
      console.error('⚠️ Error enforcing single session:', error);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        message: 'Login successful',
        token,
        operator: {
          _id: operator._id,
          name: operator.name,
          operatorName: operator.operatorName,
          role: 'operator'
        }
      })
    };

  } catch (error) {
    console.error('❌ Login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
```

---

## 📱 Frontend Integration

### Handling Force Logout Messages

The frontend must listen for `session:force_logout` messages and automatically log out:

```javascript
// Frontend WebSocket Client

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'session:force_logout') {
    // User was logged in somewhere else
    console.log('⚠️ Force logout:', message.data.message);

    // Show notification to user
    showNotification({
      type: 'warning',
      title: 'Logged Out',
      message: message.data.message ||
               'You have been logged out because a new session was started on another device'
    });

    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');

    // Redirect to login page
    window.location.href = '/login';
  }
};
```

---

### React Example with Hooks

```typescript
// hooks/useWebSocket.ts

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useWebSocket = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const ws = new WebSocket(`wss://your-api.com/dev?token=${token}`);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // Handle force logout
      if (message.type === 'session:force_logout') {
        // Show notification
        toast.warning(message.data.message);

        // Logout and redirect
        localStorage.clear();
        navigate('/login');
      }
    };

    return () => ws.close();
  }, [navigate]);
};
```

---

## 🔧 Advanced Features

### Option 1: Allow Multiple Sessions (Per-Device)

If you want to allow ONE session per device type:

```javascript
// Allow one session on desktop AND one on mobile
await enforceSingleSession(
  userId,
  userModel,
  null  // Still terminate all for now
);

// Future enhancement: Filter by platform
// Only terminate sessions on same platform
```

---

### Option 2: Show Active Sessions to User

Create an endpoint to show user where they're logged in:

```javascript
// handlers/user/sessions.js

const { getActiveSessions } = require('../../services/websocket/sessionManager');

module.exports.getUserSessions = async (event) => {
  try {
    const userId = event.requestContext.authorizer.userId; // From JWT

    const sessions = await getActiveSessions(userId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        activeSessions: sessions.map(s => ({
          platform: s.platform,
          deviceId: s.deviceId,
          connectedAt: s.connectedAt,
          lastActivity: s.lastActivity,
          location: s.ipAddress // Could use IP geolocation
        }))
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
```

**Frontend Display**:
```jsx
// Active Sessions Screen
<div>
  <h3>Your Active Sessions</h3>
  {sessions.map(session => (
    <div key={session.connectionId}>
      <strong>{session.platform}</strong> - {session.ipAddress}
      <br />
      Last active: {formatDate(session.lastActivity)}
      <button onClick={() => terminateSession(session.connectionId)}>
        Log out this device
      </button>
    </div>
  ))}
</div>
```

---

### Option 3: Admin Force Logout

Admins can forcefully logout any user:

```javascript
// handlers/admin/forceLogout.js

const { terminateAllSessions } = require('../../services/websocket/sessionManager');

module.exports.adminForceLogout = async (event) => {
  try {
    const { userId, reason } = JSON.parse(event.body);

    const count = await terminateAllSessions(userId, reason || 'admin_action');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${count} session(s) terminated`,
        userId
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
```

---

## 🧪 Testing

### Test Case 1: Login from Two Devices

1. **Home PC**: Login as manager@example.com
   - ✅ Successful login
   - ✅ WebSocket connected

2. **Office Laptop**: Login as same manager@example.com
   - ✅ Successful login
   - ✅ WebSocket connected
   - ✅ Home PC receives `session:force_logout` message
   - ✅ Home PC auto-redirects to login page

---

### Test Case 2: Multiple Rapid Logins

1. Login from Device A
2. Immediately login from Device B
3. Immediately login from Device C

**Expected**: Only Device C remains logged in, A and B are logged out

---

### Test Case 3: Offline Device

1. Home PC is logged in
2. Home PC goes offline (no WebSocket connection)
3. Office Laptop logs in

**Expected**:
- Home PC connection marked as disconnected in database
- When Home PC comes back online and tries to make API calls, JWT is still valid BUT no WebSocket connection
- On next API call, backend can optionally check session validity

---

## 📊 Monitoring

### CloudWatch Metrics to Track

```javascript
// Add custom metrics
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

// Track session enforcement
await cloudwatch.putMetricData({
  Namespace: '27Manufacturing/WebSocket',
  MetricData: [{
    MetricName: 'SessionsTerminated',
    Value: result.terminated,
    Unit: 'Count',
    Timestamp: new Date()
  }]
}).promise();
```

---

## 🔐 Security Considerations

1. **JWT Still Valid**: Even after force logout, the JWT token is technically still valid until it expires. For maximum security, consider:
   - Short JWT expiration times (1-2 hours)
   - Refresh token mechanism
   - Token blacklist (store revoked tokens in Redis)

2. **Race Conditions**: If user logs in on two devices simultaneously, both might succeed briefly before session enforcement kicks in.

3. **WebSocket Required**: This feature requires WebSocket connectivity. If WebSocket is down, fall back to JWT expiration.

---

## 🎯 Summary

### Changes Required:

1. ✅ **Created**: `services/websocket/sessionManager.js`
2. ⏳ **Update**: Login handlers (Manager, Admin, MasterAdmin, Operator)
   - Add `enforceSingleSession()` call after JWT generation
3. ⏳ **Update**: Frontend WebSocket client
   - Handle `session:force_logout` messages
   - Auto-redirect to login page

### Benefits:

- ✅ **Security**: Prevents account sharing
- ✅ **Compliance**: Audit trail of where users log in
- ✅ **User Experience**: Automatic logout, no confusion
- ✅ **Cost Savings**: Fewer simultaneous connections
- ✅ **License Compliance**: One user = one session

---

**Next Steps**: Update your login handlers with the code examples above!
