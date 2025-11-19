# Order Status & Management API Documentation

## Overview
New API endpoints for managing order status, priority, notes, and general updates after order creation.

## Base URL
- **Local Development**: `http://localhost:3000/dev`
- **Production**: Your deployed API URL

## Authentication
All endpoints require JWT authentication:
```
Authorization: Bearer <your-jwt-token>
```

**Permissions**: Admin or Manager only

---

## API Endpoints

### 1. Update Order Status
**Endpoint**: `PUT /orders/{orderId}/status`

**Description**: Updates the order status and automatically tracks start/end dates.

**Valid Status Values**:
- `pending` - Order is waiting to be processed
- `Wait for Approval` - Order awaiting manager approval
- `approved` - Order has been approved
- `in_progress` - Order is being processed (auto-sets actualStartDate)
- `completed` - Order is finished (auto-sets actualEndDate)
- `dispatched` - Order has been shipped (auto-sets actualEndDate)
- `cancelled` - Order has been cancelled

**Request Body**:
```json
{
  "status": "in_progress",
  "note": "Starting production on machine CNC-01",
  "noteType": "production"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "orderId": "ORD-2025-001",
    "oldStatus": "approved",
    "newStatus": "in_progress",
    "actualStartDate": "2025-01-15T10:30:00.000Z",
    "actualEndDate": null
  }
}
```

**Example Request**:
```javascript
// Using axios
await axios.put(
  `${BASE_URL}/orders/ORD-2025-001/status`,
  {
    status: 'in_progress',
    note: 'Starting production',
    noteType: 'production'
  },
  {
    headers: { Authorization: `Bearer ${token}` }
  }
);
```

---

### 2. Update Order Priority
**Endpoint**: `PUT /orders/{orderId}/priority`

**Description**: Changes the order priority level.

**Valid Priority Values**:
- `low` - Low priority
- `normal` - Normal priority (default)
- `high` - High priority
- `urgent` - Urgent/Critical priority

**Request Body**:
```json
{
  "priority": "urgent",
  "note": "Customer requested urgent delivery"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Order priority updated successfully",
  "data": {
    "orderId": "ORD-2025-001",
    "oldPriority": "normal",
    "newPriority": "urgent"
  }
}
```

**Example Request**:
```javascript
await axios.put(
  `${BASE_URL}/orders/ORD-2025-001/priority`,
  {
    priority: 'urgent',
    note: 'Rush order requested by customer'
  },
  {
    headers: { Authorization: `Bearer ${token}` }
  }
);
```

---

### 3. Add Order Note
**Endpoint**: `POST /orders/{orderId}/notes`

**Description**: Adds a note/comment to the order.

**Valid Note Types**:
- `general` - General notes (default)
- `production` - Production-related notes
- `quality` - Quality control notes
- `delivery` - Delivery/shipping notes
- `customer` - Customer communication notes

**Request Body**:
```json
{
  "message": "Quality check passed. Efficiency: 95%",
  "noteType": "quality"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Note added successfully",
  "data": {
    "orderId": "ORD-2025-001",
    "note": {
      "message": "Quality check passed. Efficiency: 95%",
      "createdBy": "John Doe",
      "createdAt": "2025-01-15T14:30:00.000Z",
      "noteType": "quality"
    },
    "totalNotes": 5
  }
}
```

**Example Request**:
```javascript
await axios.post(
  `${BASE_URL}/orders/ORD-2025-001/notes`,
  {
    message: 'Customer called - requested color change',
    noteType: 'customer'
  },
  {
    headers: { Authorization: `Bearer ${token}` }
  }
);
```

---

### 4. Update Order (General)
**Endpoint**: `PUT /orders/{orderId}`

**Description**: Updates general order fields (not status or priority - use dedicated endpoints for those).

**Allowed Fields**:
- `scheduledStartDate` - When production should start
- `scheduledEndDate` - When production should end
- `specialInstructions` - Special instructions for production
- `designNotes` - Design/specification notes
- `colors` - Array of colors
- `Printing` - Boolean - whether printing is required
- `SealingType` - Sealing type specification
- `BottomGusset` - Bottom gusset specification
- `Flap` - Flap specification
- `AirHole` - Air hole specification

**Request Body**:
```json
{
  "scheduledStartDate": "2025-01-20T08:00:00.000Z",
  "scheduledEndDate": "2025-01-25T17:00:00.000Z",
  "specialInstructions": "Handle with extra care - premium customer",
  "colors": ["Red", "Blue", "White"],
  "Printing": true,
  "note": "Updated schedule per customer request"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Order updated successfully",
  "data": {
    "orderId": "ORD-2025-001",
    "updatedFields": [
      "scheduledStartDate",
      "scheduledEndDate",
      "specialInstructions",
      "colors",
      "Printing"
    ]
  }
}
```

**Example Request**:
```javascript
await axios.put(
  `${BASE_URL}/orders/ORD-2025-001`,
  {
    specialInstructions: 'Use premium grade material',
    Printing: true,
    note: 'Customer upgraded to premium package'
  },
  {
    headers: { Authorization: `Bearer ${token}` }
  }
);
```

---

## Automatic Features

### 1. Date Tracking
When you update order status, dates are automatically tracked:

| Status | Auto-Updated Field |
|--------|-------------------|
| `in_progress` | Sets `actualStartDate` (if not already set) |
| `completed` | Sets `actualEndDate` (if not already set) |
| `dispatched` | Sets `actualEndDate` (if not already set) |

### 2. Note History
Every status and priority change automatically creates a note in the order history:

```javascript
// Automatic note when status changes
{
  message: "Status changed from approved to in_progress",
  createdBy: "John Doe",
  createdAt: "2025-01-15T10:30:00.000Z",
  noteType: "general"
}
```

You can provide a custom note to replace the automatic message:
```javascript
{
  status: "in_progress",
  note: "Production started on CNC-01 with operator Mike",
  noteType: "production"
}
```

---

## Complete Workflow Example

### Workflow: From Creation to Dispatch

```javascript
const BASE_URL = 'http://localhost:3000/dev';
const token = 'your-jwt-token';
const orderId = 'ORD-2025-001';

// 1. Order is created (status: "Wait for Approval")
// ... order creation code ...

// 2. Manager approves the order
await axios.put(
  `${BASE_URL}/orders/${orderId}/status`,
  {
    status: 'approved',
    note: 'All specifications verified. Approved for production.',
    noteType: 'general'
  },
  { headers: { Authorization: `Bearer ${token}` } }
);

// 3. Set as high priority
await axios.put(
  `${BASE_URL}/orders/${orderId}/priority`,
  {
    priority: 'high',
    note: 'VIP customer - expedite production'
  },
  { headers: { Authorization: `Bearer ${token}` } }
);

// 4. Production starts
await axios.put(
  `${BASE_URL}/orders/${orderId}/status`,
  {
    status: 'in_progress',
    note: 'Production started on Machine CNC-01',
    noteType: 'production'
  },
  { headers: { Authorization: `Bearer ${token}` } }
);
// This automatically sets actualStartDate

// 5. Quality check during production
await axios.post(
  `${BASE_URL}/orders/${orderId}/notes`,
  {
    message: 'Mid-production quality check: 95% efficiency, minimal wastage',
    noteType: 'quality'
  },
  { headers: { Authorization: `Bearer ${token}` } }
);

// 6. Production completes
await axios.put(
  `${BASE_URL}/orders/${orderId}/status`,
  {
    status: 'completed',
    note: 'Production completed successfully. Total output: 5000 units',
    noteType: 'production'
  },
  { headers: { Authorization: `Bearer ${token}` } }
);
// This automatically sets actualEndDate

// 7. Order is dispatched
await axios.put(
  `${BASE_URL}/orders/${orderId}/status`,
  {
    status: 'dispatched',
    note: 'Dispatched via Express Shipping. Tracking: EX123456',
    noteType: 'delivery'
  },
  { headers: { Authorization: `Bearer ${token}` } }
);

// 8. Customer feedback
await axios.post(
  `${BASE_URL}/orders/${orderId}/notes`,
  {
    message: 'Customer confirmed receipt. Very satisfied with quality.',
    noteType: 'customer'
  },
  { headers: { Authorization: `Bearer ${token}` } }
);
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid status. Must be one of: pending, in_progress, dispatched, cancelled, Wait for Approval, completed, approved"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Order not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to update order status",
  "error": "Detailed error message (development only)"
}
```

---

## Testing with cURL

### Update Status
```bash
curl -X PUT "http://localhost:3000/dev/orders/ORD-2025-001/status" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "note": "Starting production",
    "noteType": "production"
  }'
```

### Update Priority
```bash
curl -X PUT "http://localhost:3000/dev/orders/ORD-2025-001/priority" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "urgent",
    "note": "Rush order"
  }'
```

### Add Note
```bash
curl -X POST "http://localhost:3000/dev/orders/ORD-2025-001/notes" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quality check completed",
    "noteType": "quality"
  }'
```

### Update Order Fields
```bash
curl -X PUT "http://localhost:3000/dev/orders/ORD-2025-001" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "specialInstructions": "Premium quality required",
    "Printing": true,
    "note": "Customer upgraded package"
  }'
```

---

## Database Schema

### Order Model - Relevant Fields

```javascript
{
  orderId: "ORD-2025-001",

  // Status tracking
  overallStatus: "in_progress", // Current status
  actualStartDate: "2025-01-15T10:30:00.000Z", // Auto-set when status -> in_progress
  actualEndDate: null, // Auto-set when status -> completed/dispatched

  // Priority
  priority: "urgent", // low, normal, high, urgent

  // Scheduling
  scheduledStartDate: "2025-01-20T08:00:00.000Z",
  scheduledEndDate: "2025-01-25T17:00:00.000Z",

  // Notes array
  notes: [
    {
      message: "Status changed from approved to in_progress",
      createdBy: "John Doe",
      createdAt: "2025-01-15T10:30:00.000Z",
      noteType: "general"
    },
    {
      message: "Quality check completed - 95% efficiency",
      createdBy: "Jane Smith",
      createdAt: "2025-01-15T14:30:00.000Z",
      noteType: "quality"
    }
  ],

  // Other fields...
  specialInstructions: "Handle with care",
  designNotes: "Custom design specifications",
  colors: ["Red", "Blue"],
  Printing: true
}
```

---

## Best Practices

1. **Status Updates**: Always provide meaningful notes when changing status
2. **Priority Changes**: Document why priority was changed
3. **Note Types**: Use appropriate noteType for better organization
4. **Error Handling**: Always catch and handle errors appropriately
5. **Validation**: Frontend should validate status/priority values before sending

---

## Integration Example (React/Redux)

```javascript
// actions/orderActions.js
export const updateOrderStatus = (orderId, status, note, noteType = 'general') => {
  return async (dispatch, getState) => {
    try {
      dispatch({ type: 'UPDATE_ORDER_STATUS_REQUEST' });

      const token = getState().auth.token;

      const response = await axios.put(
        `${BASE_URL}/orders/${orderId}/status`,
        { status, note, noteType },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      dispatch({
        type: 'UPDATE_ORDER_STATUS_SUCCESS',
        payload: response.data.data
      });

      // Refresh order list
      dispatch(getAllOrders());

      return response.data;
    } catch (error) {
      dispatch({
        type: 'UPDATE_ORDER_STATUS_FAILURE',
        payload: error.response?.data?.message || error.message
      });
      throw error;
    }
  };
};

export const updateOrderPriority = (orderId, priority, note) => {
  return async (dispatch, getState) => {
    try {
      const token = getState().auth.token;

      const response = await axios.put(
        `${BASE_URL}/orders/${orderId}/priority`,
        { priority, note },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      dispatch({ type: 'UPDATE_ORDER_PRIORITY_SUCCESS', payload: response.data.data });
      dispatch(getAllOrders());

      return response.data;
    } catch (error) {
      throw error;
    }
  };
};

export const addOrderNote = (orderId, message, noteType = 'general') => {
  return async (dispatch, getState) => {
    try {
      const token = getState().auth.token;

      const response = await axios.post(
        `${BASE_URL}/orders/${orderId}/notes`,
        { message, noteType },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      dispatch({ type: 'ADD_ORDER_NOTE_SUCCESS', payload: response.data.data });

      return response.data;
    } catch (error) {
      throw error;
    }
  };
};
```

---

## Summary

✅ **4 New Endpoints Added**:
1. `PUT /orders/{orderId}/status` - Update order status
2. `PUT /orders/{orderId}/priority` - Update order priority
3. `POST /orders/{orderId}/notes` - Add order notes
4. `PUT /orders/{orderId}` - Update general order fields

✅ **Features**:
- Automatic date tracking (actualStartDate, actualEndDate)
- Automatic note creation on status/priority changes
- Validation of status and priority values
- Support for different note types
- JWT authentication required
- Full CORS support

✅ **Status Options**: pending, Wait for Approval, approved, in_progress, completed, dispatched, cancelled

✅ **Priority Levels**: low, normal, high, urgent

✅ **Note Types**: general, production, quality, delivery, customer

✅ **No UI/UX Changes**: These are backend endpoints only - integrate with your existing frontend without changing the UI
