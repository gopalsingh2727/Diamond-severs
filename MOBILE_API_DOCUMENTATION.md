# 📱 Mobile API Documentation

Complete API documentation for mobile applications (Operator & Manager interfaces).

## 🔑 Authentication

All endpoints require:
- **API Key**: `x-api-key` header
- **Authorization**: `Bearer <token>` (for manager endpoints)
- **PIN Authentication**: For operator endpoints

## 📲 Base URL

```
Production: https://your-api-gateway-url.amazonaws.com/dev
Local: http://localhost:4000
```

---

## 👷 OPERATOR MOBILE ENDPOINTS

### 1. Operator Login (PIN)

**Endpoint:** `POST /mobile/operator/login`

**Description:** Authenticate operator using 4-digit PIN.

**Request:**
```json
{
  "pin": "1234",
  "branchId": "507f1f77bcf86cd799439011",
  "machineId": "507f1f77bcf86cd799439012" // Optional
}
```

**Response:**
```json
{
  "message": "Login successful",
  "operator": {
    "id": "507f1f77bcf86cd799439013",
    "username": "john_operator",
    "machineId": "507f1f77bcf86cd799439012",
    "machineName": "Extruder Machine 1",
    "machineType": "Extruder",
    "branchId": "507f1f77bcf86cd799439011"
  },
  "sessionToken": "op_507f1f77bcf86cd799439013_1234567890"
}
```

---

### 2. Get Operator's Machine

**Endpoint:** `GET /mobile/operator/machine?operatorId={operatorId}`

**Description:** Get details of the operator's assigned machine.

**Response:**
```json
{
  "machine": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Extruder Machine 1",
    "type": {
      "type": "Extruder",
      "description": "Plastic extrusion machine"
    },
    "status": "running",
    "capacity": 1000,
    "currentLoad": 750
  }
}
```

---

### 3. Get Pending Orders

**Endpoint:** `GET /mobile/operator/orders/pending?operatorId={operatorId}&limit=20`

**Description:** Get list of pending/in-progress orders for the operator's machine.

**Response:**
```json
{
  "orders": [
    {
      "id": "507f1f77bcf86cd799439014",
      "orderNumber": "ORD-2025-001",
      "customerName": "ABC Company",
      "contactNumber": "+1234567890",
      "deliveryDate": "2025-11-20T00:00:00.000Z",
      "priority": "high",
      "status": "in_progress",
      "startedAt": "2025-11-14T10:30:00.000Z",
      "completedPercentage": 45,
      "notes": "Handle with care"
    }
  ],
  "count": 1
}
```

---

### 4. Start Order

**Endpoint:** `POST /mobile/operator/order/start`

**Description:** Start working on an order.

**Request:**
```json
{
  "operatorId": "507f1f77bcf86cd799439013",
  "orderId": "507f1f77bcf86cd799439014"
}
```

**Response:**
```json
{
  "message": "Order started successfully",
  "order": {
    "id": "507f1f77bcf86cd799439014",
    "orderNumber": "ORD-2025-001",
    "status": "in_progress",
    "startedAt": "2025-11-14T10:30:00.000Z"
  }
}
```

---

### 5. Update Order Progress

**Endpoint:** `POST /mobile/operator/order/progress`

**Description:** Update order completion percentage.

**Request:**
```json
{
  "operatorId": "507f1f77bcf86cd799439013",
  "orderId": "507f1f77bcf86cd799439014",
  "completedPercentage": 75,
  "notes": "Running smoothly"
}
```

**Response:**
```json
{
  "message": "Progress updated successfully",
  "completedPercentage": 75,
  "status": "in_progress"
}
```

---

### 6. Pause Order

**Endpoint:** `POST /mobile/operator/order/pause`

**Description:** Pause an order (e.g., for break, machine issue).

**Request:**
```json
{
  "operatorId": "507f1f77bcf86cd799439013",
  "orderId": "507f1f77bcf86cd799439014",
  "reason": "Machine maintenance required"
}
```

**Response:**
```json
{
  "message": "Order paused successfully"
}
```

---

### 7. Resume Order

**Endpoint:** `POST /mobile/operator/order/resume`

**Description:** Resume a paused order.

**Request:**
```json
{
  "operatorId": "507f1f77bcf86cd799439013",
  "orderId": "507f1f77bcf86cd799439014"
}
```

**Response:**
```json
{
  "message": "Order resumed successfully"
}
```

---

### 8. Get Work History

**Endpoint:** `GET /mobile/operator/history?operatorId={operatorId}&days=7&limit=50`

**Description:** Get operator's work history for the last N days.

**Response:**
```json
{
  "history": [
    {
      "id": "507f1f77bcf86cd799439014",
      "orderNumber": "ORD-2025-001",
      "customerName": "ABC Company",
      "status": "completed",
      "startedAt": "2025-11-14T10:30:00.000Z",
      "completedAt": "2025-11-14T16:00:00.000Z",
      "completedPercentage": 100
    }
  ],
  "count": 1
}
```

---

## 👨‍💼 MANAGER MOBILE ENDPOINTS

### 1. Manager Dashboard

**Endpoint:** `GET /mobile/manager/dashboard`

**Headers:** `Authorization: Bearer <manager-token>`

**Description:** Get overview dashboard for manager.

**Response:**
```json
{
  "summary": {
    "totalMachines": 10,
    "activeMachines": 8,
    "inactiveMachines": 2,
    "totalOperators": 15,
    "pendingOrders": 5,
    "inProgressOrders": 12,
    "completedToday": 8
  },
  "machineStatuses": [
    { "_id": "running", "count": 8 },
    { "_id": "offline", "count": 2 }
  ],
  "recentOrders": [
    {
      "orderNumber": "ORD-2025-001",
      "customerName": "ABC Company",
      "status": "in_progress",
      "priority": "high",
      "deliveryDate": "2025-11-20T00:00:00.000Z",
      "createdAt": "2025-11-14T10:00:00.000Z"
    }
  ]
}
```

---

### 2. Get Machines Status

**Endpoint:** `GET /mobile/manager/machines/status`

**Headers:** `Authorization: Bearer <manager-token>`

**Description:** Get real-time status of all machines.

**Response:**
```json
{
  "machines": [
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "Extruder Machine 1",
      "type": "Extruder",
      "status": "running",
      "capacity": 1000,
      "currentLoad": 750,
      "utilization": 75,
      "activeOrders": [
        {
          "orderNumber": "ORD-2025-001",
          "status": "in_progress",
          "completedPercentage": 45
        }
      ]
    }
  ],
  "timestamp": "2025-11-14T12:00:00.000Z"
}
```

---

### 3. Get Orders Overview

**Endpoint:** `GET /mobile/manager/orders/overview?status=in_progress&priority=high&limit=50`

**Headers:** `Authorization: Bearer <manager-token>`

**Description:** Get filtered list of orders.

**Response:**
```json
{
  "orders": [
    {
      "id": "507f1f77bcf86cd799439014",
      "orderNumber": "ORD-2025-001",
      "customerName": "ABC Company",
      "contactNumber": "+1234567890",
      "deliveryDate": "2025-11-20T00:00:00.000Z",
      "priority": "high",
      "status": "in_progress",
      "progress": 45,
      "machines": [
        {
          "machineId": "507f1f77bcf86cd799439012",
          "machineName": "Extruder Machine 1",
          "status": "in_progress",
          "progress": 45
        }
      ],
      "createdAt": "2025-11-14T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 4. Get Operators Status

**Endpoint:** `GET /mobile/manager/operators/status`

**Headers:** `Authorization: Bearer <manager-token>`

**Description:** Get real-time status of all operators.

**Response:**
```json
{
  "operators": [
    {
      "id": "507f1f77bcf86cd799439013",
      "username": "john_operator",
      "machine": {
        "id": "507f1f77bcf86cd799439012",
        "name": "Extruder Machine 1",
        "type": "Extruder",
        "status": "running"
      },
      "currentWork": {
        "orderNumber": "ORD-2025-001",
        "status": "in_progress",
        "progress": 45,
        "startedAt": "2025-11-14T10:30:00.000Z"
      },
      "isActive": true
    }
  ],
  "activeCount": 8,
  "totalCount": 15
}
```

---

### 5. Get Production Analytics

**Endpoint:** `GET /mobile/manager/analytics/production?days=7`

**Headers:** `Authorization: Bearer <manager-token>`

**Description:** Get production analytics for the last N days.

**Response:**
```json
{
  "period": {
    "days": 7,
    "startDate": "2025-11-07T00:00:00.000Z",
    "endDate": "2025-11-14T00:00:00.000Z"
  },
  "orders": [
    {
      "_id": "2025-11-14",
      "total": 20,
      "completed": 15,
      "pending": 3,
      "inProgress": 2
    }
  ],
  "machineUtilization": [
    { "name": "Extruder Machine 1", "utilization": 75 },
    { "name": "Extruder Machine 2", "utilization": 60 }
  ]
}
```

---

### 6. Assign Order to Machine

**Endpoint:** `POST /mobile/manager/order/assign`

**Headers:** `Authorization: Bearer <manager-token>`

**Description:** Assign an order to a machine.

**Request:**
```json
{
  "orderId": "507f1f77bcf86cd799439014",
  "machineId": "507f1f77bcf86cd799439012",
  "priority": "high"
}
```

**Response:**
```json
{
  "message": "Order assigned successfully",
  "order": {
    "id": "507f1f77bcf86cd799439014",
    "orderNumber": "ORD-2025-001",
    "machines": [
      {
        "machineId": "507f1f77bcf86cd799439012",
        "machineName": "Extruder Machine 1",
        "status": "pending",
        "assignedAt": "2025-11-14T12:00:00.000Z"
      }
    ]
  }
}
```

---

### 7. Get Alerts

**Endpoint:** `GET /mobile/manager/alerts`

**Headers:** `Authorization: Bearer <manager-token>`

**Description:** Get system alerts and notifications.

**Response:**
```json
{
  "alerts": [
    {
      "type": "danger",
      "title": "Overdue Orders",
      "message": "3 order(s) are past their delivery date",
      "count": 3
    },
    {
      "type": "warning",
      "title": "High Priority Pending",
      "message": "5 high priority order(s) waiting to start",
      "count": 5
    }
  ],
  "timestamp": "2025-11-14T12:00:00.000Z"
}
```

---

## 🏥 HEALTH & MONITORING ENDPOINTS

### 1. Basic Health Check

**Endpoint:** `GET /health`

**Description:** Basic health check (no auth required).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T12:00:00.000Z",
  "uptime": 3600,
  "service": "this27-backend",
  "version": "1.0.0"
}
```

---

### 2. Detailed Health Check

**Endpoint:** `GET /health/detailed`

**Description:** Detailed health check with dependencies.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T12:00:00.000Z",
  "uptime": 3600,
  "service": "this27-backend",
  "version": "1.0.0",
  "checks": {
    "mongodb": "healthy",
    "redis": "healthy"
  },
  "memory": {
    "used": "150MB",
    "total": "512MB"
  }
}
```

---

## ⚠️ Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "message": "PIN must be exactly 4 digits"
}
```

### 401 Unauthorized
```json
{
  "message": "Invalid token"
}
```

### 403 Forbidden
```json
{
  "message": "Manager access required"
}
```

### 404 Not Found
```json
{
  "message": "Operator not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error",
  "requestId": "req_1234567890_abc123"
}
```

---

## 🚀 Performance

- **Operator endpoints**: Optimized for low latency (~100-200ms)
- **Manager endpoints**: Optimized for data aggregation (~200-500ms)
- **Caching**: Redis caching for frequently accessed data
- **Memory**: Lightweight functions (256-512MB)
- **Timeout**: 10-15 seconds max

---

## 📝 Notes

1. **Session Management**: Operator sessions are temporary tokens. In production, use proper JWT tokens.
2. **Real-time Updates**: Consider WebSocket integration for live updates.
3. **Offline Support**: Implement local storage in mobile app for offline capability.
4. **Rate Limiting**: Add rate limiting per operator/manager to prevent abuse.
5. **Pagination**: All list endpoints support pagination via `limit` and `offset` parameters.

---

## 🔐 Security Best Practices

1. **Always use HTTPS** in production
2. **Store API keys securely** in mobile app
3. **Implement PIN retry limits** (max 3 attempts)
4. **Use JWT with short expiry** (15-30 minutes)
5. **Implement refresh token mechanism**
6. **Log all operator actions** for audit trail

---

## 📱 Mobile App Integration Example

```javascript
// Operator Login
const operatorLogin = async (pin, branchId) => {
  const response = await fetch('https://api.your-domain.com/mobile/operator/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key'
    },
    body: JSON.stringify({ pin, branchId })
  });

  const data = await response.json();

  if (response.ok) {
    // Store session token
    await AsyncStorage.setItem('operatorToken', data.sessionToken);
    await AsyncStorage.setItem('operatorData', JSON.stringify(data.operator));
    return data;
  } else {
    throw new Error(data.message);
  }
};

// Get Pending Orders
const getPendingOrders = async (operatorId) => {
  const response = await fetch(
    `https://api.your-domain.com/mobile/operator/orders/pending?operatorId=${operatorId}`,
    {
      headers: {
        'x-api-key': 'your-api-key'
      }
    }
  );

  return await response.json();
};
```

---

## 🎯 Next Steps

1. **Implement WebSocket** for real-time order updates
2. **Add push notifications** for alerts
3. **Implement offline mode** with local database sync
4. **Add barcode/QR scanning** for quick order lookup
5. **Create mobile SDK** for easier integration
