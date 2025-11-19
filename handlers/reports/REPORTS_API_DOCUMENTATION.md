# Reports API Documentation

## Overview
This document describes all available reports API endpoints in the backend system.

## Base URL
- **Local Development**: `http://localhost:3000/dev`
- **Production**: Your deployed API URL

## Authentication
All endpoints require JWT authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Available Reports

### 1. Overview Report
**Endpoint**: `GET /reports/overview`

**Description**: Provides a comprehensive overview of all orders, efficiency trends, and production output.

**Query Parameters**:
- `branchId` (optional): Filter by specific branch
- `startDate` (optional): Start date for date range filter (ISO 8601 format)
- `endDate` (optional): End date for date range filter (ISO 8601 format)

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "efficiencyTrends": [
      {
        "date": "2025-01-15",
        "efficiency": 92.5,
        "orders": 15
      }
    ],
    "productionOutput": [
      {
        "date": "2025-01-15",
        "netWeight": 1250.5,
        "wastage": 45.2,
        "rawWeight": 1295.7
      }
    ],
    "summary": {
      "totalOrders": 150,
      "completedOrders": 120,
      "inProgressOrders": 20,
      "pendingOrders": 8,
      "cancelledOrders": 2,
      "totalProduction": 15420.5,
      "totalWastage": 450.3,
      "averageEfficiency": 91.2
    }
  },
  "message": "Overview report fetched successfully"
}
```

**Example Request**:
```javascript
// Using Redux action
dispatch(fetchOverviewReport({
  from: new Date('2025-01-01'),
  to: new Date('2025-01-31')
}));

// Direct API call
const response = await axios.get(
  `${BASE_URL}/reports/overview?startDate=2025-01-01&endDate=2025-01-31`,
  { headers: { Authorization: `Bearer ${token}` } }
);
```

---

### 2. Orders Report
**Endpoint**: `GET /reports/orders`

**Description**: Detailed report of all orders with filtering and pagination.

**Query Parameters**:
- `branchId` (optional): Filter by branch
- `status` (optional): Filter by order status (pending, in_progress, completed, cancelled, Wait for Approval)
- `priority` (optional): Filter by priority (low, normal, high, urgent)
- `customerId` (optional): Filter by customer
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter
- `page` (optional, default: 1): Page number for pagination
- `limit` (optional, default: 50): Number of results per page

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalCount": 250,
      "totalPages": 5
    },
    "statusCounts": {
      "pending": 30,
      "in_progress": 45,
      "completed": 150,
      "cancelled": 10,
      "Wait for Approval": 15
    }
  },
  "message": "Orders report fetched successfully"
}
```

**Example Request**:
```javascript
// Using Redux action
dispatch(fetchOrdersReport({
  status: 'in_progress',
  priority: 'high',
  page: 1,
  limit: 20
}));
```

---

### 3. Production Report
**Endpoint**: `GET /reports/production`

**Description**: Comprehensive production analytics including material usage and production output.

**Query Parameters**:
- `branchId` (optional): Filter by branch
- `materialType` (optional): Filter by material type
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "materials": [...],
    "productionOutput": [
      {
        "date": "2025-01-15",
        "netWeight": 1250.5,
        "wastage": 45.2,
        "rawWeight": 1295.7
      }
    ],
    "materialUsage": [
      {
        "material": "Steel Grade A",
        "totalUsed": 5000,
        "totalProduction": 4750,
        "totalWastage": 250,
        "orders": 15
      }
    ],
    "summary": {
      "totalOrders": 150,
      "totalProduction": 15420.5,
      "totalWastage": 450.3,
      "totalRawWeight": 15870.8,
      "wastagePercentage": 2.8,
      "averageEfficiency": 91.2
    }
  },
  "message": "Production report fetched successfully"
}
```

**Example Request**:
```javascript
// Using Redux action
dispatch(fetchProductionReport({
  materialType: 'steel',
  dateRange: {
    from: new Date('2025-01-01'),
    to: new Date('2025-01-31')
  }
}));
```

---

### 4. Machines Report
**Endpoint**: `GET /reports/machines`

**Description**: Machine performance, utilization, and status report.

**Query Parameters**:
- `branchId` (optional): Filter by branch
- `machineType` (optional): Filter by machine type
- `status` (optional): Filter by machine status (active, inactive, maintenance)
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "machines": [...],
    "machineUtilization": [
      {
        "date": "2025-01-15",
        "utilizationRate": 85.5,
        "activeMachines": 12,
        "totalMachines": 15
      }
    ],
    "machinePerformance": [
      {
        "machineId": "507f1f77bcf86cd799439011",
        "machineName": "CNC-01",
        "efficiency": 92.5,
        "totalProduction": 1500.5,
        "totalWastage": 50.2,
        "status": "active"
      }
    ],
    "summary": {
      "totalMachines": 15,
      "activeMachines": 12,
      "inactiveMachines": 2,
      "maintenanceMachines": 1,
      "averageUtilization": 85.5,
      "averageEfficiency": 90.2
    }
  },
  "message": "Machines report fetched successfully"
}
```

**Example Request**:
```javascript
// Using Redux action
dispatch(fetchMachinesReport({
  machineType: 'cnc',
  status: 'active'
}));
```

---

### 5. Customers Report
**Endpoint**: `GET /reports/customers`

**Description**: Customer analytics with order history and production statistics.

**Query Parameters**:
- `branchId` (optional): Filter by branch
- `startDate` (optional): Start date filter for orders
- `endDate` (optional): End date filter for orders

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "companyName": "ABC Industries",
        "name": "John Doe",
        "phone": "+1234567890",
        "email": "john@abc.com",
        "totalOrders": 50,
        "completedOrders": 45,
        "pendingOrders": 3,
        "inProgressOrders": 2,
        "cancelledOrders": 0,
        "totalProduction": 5000.5,
        "lastOrderDate": "2025-01-15T10:30:00Z"
      }
    ],
    "orders": [...],
    "summary": {
      "totalCustomers": 50,
      "activeCustomers": 42,
      "inactiveCustomers": 8,
      "totalOrders": 500,
      "totalProduction": 50000.5
    }
  },
  "message": "Customers report fetched successfully"
}
```

**Example Request**:
```javascript
// Using Redux action
dispatch(fetchCustomersReport({
  dateRange: {
    from: new Date('2025-01-01'),
    to: new Date('2025-01-31')
  }
}));
```

---

### 6. Materials Report
**Endpoint**: `GET /reports/materials`

**Description**: Material usage statistics and inventory analytics.

**Query Parameters**:
- `branchId` (optional): Filter by branch
- `startDate` (optional): Start date filter for orders
- `endDate` (optional): End date filter for orders

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "materials": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Steel Grade A",
        "materialTypeId": {
          "_id": "507f1f77bcf86cd799439012",
          "type": "Steel"
        },
        "totalOrders": 50,
        "totalUsed": 5000,
        "totalProduction": 4750,
        "totalWastage": 250
      }
    ],
    "summary": {
      "totalMaterials": 25,
      "totalMaterialTypes": 5,
      "totalUsed": 50000,
      "totalProduction": 47500,
      "totalWastage": 2500
    }
  },
  "message": "Materials report fetched successfully"
}
```

**Example Request**:
```javascript
// Using Redux action
dispatch(fetchMaterials());
```

---

### 7. Custom Report (Dynamic)
**Endpoint**: `GET /reports/custom` or `POST /reports/custom`

**Description**: Build custom reports with flexible filtering and data selection.

**Query Parameters (GET)**:
- `branchId` (optional): Filter by branch
- `reportType` (optional): Type of report (orders, machines, customers, materials)
- `startDate` (optional): Start date filter
- `endDate` (optional): End date filter

**Request Body (POST)**:
```json
{
  "reportType": "orders",
  "branchId": "507f1f77bcf86cd799439011",
  "filters": {
    "status": "in_progress",
    "priority": "high",
    "customerId": "507f1f77bcf86cd799439012"
  },
  "dateRange": {
    "from": "2025-01-01T00:00:00Z",
    "to": "2025-01-31T23:59:59Z"
  }
}
```

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "machines": [...],
    "customers": [...],
    "materials": [...]
  },
  "reportConfig": {
    "reportType": "orders",
    "filters": {...}
  },
  "message": "Custom report fetched successfully"
}
```

**Example Request**:
```javascript
// POST request for complex custom reports
const response = await axios.post(
  `${BASE_URL}/reports/custom`,
  {
    reportType: 'orders',
    filters: {
      status: 'in_progress',
      priority: 'high'
    },
    dateRange: {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31')
    }
  },
  { headers: { Authorization: `Bearer ${token}` } }
);
```

---

## Error Responses

All endpoints return standardized error responses:

**401 Unauthorized**:
```json
{
  "success": false,
  "error": "Invalid token",
  "message": "Failed to fetch report"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "Database connection failed",
  "message": "Failed to fetch report"
}
```

---

## Integration with Redux

### 1. Import Actions
```javascript
import {
  fetchOverviewReport,
  fetchOrdersReport,
  fetchProductionReport,
  fetchMachinesReport,
  fetchCustomersReport,
  fetchMaterials
} from './redux/reports/reportActions';
```

### 2. Use in Components
```javascript
import { useDispatch, useSelector } from 'react-redux';

function ReportsPage() {
  const dispatch = useDispatch();
  const reportState = useSelector(state => state.reports);

  useEffect(() => {
    dispatch(fetchOverviewReport());
  }, [dispatch]);

  return (
    <div>
      {reportState.loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {/* Render report data */}
        </div>
      )}
    </div>
  );
}
```

### 3. Access State
```javascript
const {
  overview,
  orders,
  production,
  machines,
  customers,
  filters,
  loading,
  error
} = useSelector(state => state.reports);
```

---

## Rate Limiting & Performance

- All endpoints support pagination for large datasets
- Maximum limit per request: 50 items (orders report)
- Date range queries are optimized with indexes
- Response caching recommended for frequently accessed reports

---

## Notes

1. **Branch Filtering**: Manager role users automatically get filtered data by their assigned branch
2. **Date Ranges**: Always use ISO 8601 format for date parameters
3. **Pagination**: Only the Orders Report supports pagination
4. **Real-time Data**: Reports reflect real-time data from orders, machines, and production
5. **Aggregations**: Summary statistics are calculated on-the-fly for accurate reporting

---

## Frontend Integration Example

```javascript
// main27/src/componest/redux/reports/reportActions.ts
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_27INFINITY_IN;

export const fetchOverviewReport = (dateRange) => async (dispatch, getState) => {
  try {
    dispatch({ type: 'FETCH_OVERVIEW_REQUEST' });

    const token = getState().auth?.token;
    const branchId = localStorage.getItem('selectedBranch');

    const params = { branchId };
    if (dateRange) {
      params.startDate = dateRange.from.toISOString();
      params.endDate = dateRange.to.toISOString();
    }

    const response = await axios.get(`${BASE_URL}/reports/overview`, {
      params,
      headers: { Authorization: `Bearer ${token}` }
    });

    dispatch({
      type: 'FETCH_OVERVIEW_SUCCESS',
      payload: response.data.data
    });
  } catch (error) {
    dispatch({
      type: 'FETCH_OVERVIEW_FAILURE',
      payload: error.message
    });
  }
};
```

---

## Testing

Test the endpoints using curl or Postman:

```bash
# Get Overview Report
curl -X GET "http://localhost:3000/dev/reports/overview?startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get Orders Report with filters
curl -X GET "http://localhost:3000/dev/reports/orders?status=in_progress&priority=high&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get Production Report
curl -X GET "http://localhost:3000/dev/reports/production?materialType=steel" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Custom Report (POST)
curl -X POST "http://localhost:3000/dev/reports/custom" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "orders",
    "filters": {
      "status": "in_progress"
    }
  }'
```

---

## Support

For issues or questions, please contact the development team or refer to the main project documentation.
