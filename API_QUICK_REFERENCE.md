# API Quick Reference - Enhanced Machine Data System

## 🚀 Quick Start

All endpoints require authentication via JWT token in the `Authorization` header:
```
Authorization: Bearer <your-jwt-token>
```

## 📋 ProductSpec Management

### Create ProductSpec
```http
POST /api/product-spec
Content-Type: application/json

{
  "specName": "Plastic Bag Spec A",
  "description": "Standard plastic bag specification",
  "category": "plastic_bags",
  "dimensions": [
    {
      "name": "width",
      "dataType": "number",
      "unit": "mm",
      "isRequired": true,
      "order": 1,
      "min": 0,
      "max": 10000
    },
    {
      "name": "height",
      "dataType": "number",
      "unit": "mm",
      "isRequired": true,
      "order": 2
    }
  ],
  "formulas": {
    "area": {
      "expression": "width * height",
      "dependencies": ["width", "height"]
    }
  },
  "branchId": "507f1f77bcf86cd799439011"
}
```

### Get All ProductSpecs
```http
GET /api/product-spec?branchId={branchId}&category={category}&isActive=true
```

### Get ProductSpec by ID
```http
GET /api/product-spec/{id}
```

### Update ProductSpec
```http
PUT /api/product-spec/{id}
Content-Type: application/json

{
  "specName": "Updated Spec Name",
  "isActive": false
}
```

## 🔧 Machine-ProductSpec Configuration

### Create Configuration
```http
POST /api/machine-config
Content-Type: application/json

{
  "machineId": "507f1f77bcf86cd799439012",
  "productSpecId": "507f1f77bcf86cd799439013",
  "capturedDimensions": ["width", "height", "thickness"],
  "additionalFields": [
    {
      "name": "machine_speed",
      "dataType": "number",
      "unit": "pcs/min",
      "isRequired": false,
      "order": 10
    }
  ],
  "machineFormulas": {
    "production_rate": {
      "expression": "machine_speed * 60",
      "dependencies": ["machine_speed"]
    }
  }
}
```

### Get Merged Dimensions
```http
GET /api/machine-config/dimensions?machineId={machineId}&productSpecId={productSpecId}

Response:
{
  "success": true,
  "data": {
    "dimensions": [...],  // Combined ProductSpec + machine-specific
    "formulas": {...}     // Merged formulas
  }
}
```

### Get All Configurations
```http
GET /api/machine-config?machineId={machineId}&productSpecId={productSpecId}&isActive=true
```

## 📊 Enhanced Table Data (with Validation)

### Create Single Row (Validated)
```http
POST /api/table-data/validated
Content-Type: application/json

{
  "machineId": "507f1f77bcf86cd799439012",
  "orderId": "507f1f77bcf86cd799439014",
  "productSpecId": "507f1f77bcf86cd799439013",
  "rowData": {
    "width": 300,
    "height": 400,
    "thickness": 50,
    "machine_speed": 120
  }
}

Response:
{
  "success": true,
  "data": {
    "id": "...",
    "rowData": {
      "rowId": "row_...",
      "dimensions": { "width": 300, "height": 400, ... },
      "calculatedValues": {
        "area": 120000,
        "production_rate": 7200
      },
      "timestamp": "2025-11-12T...",
      "operatorId": "...",
      "validationWarnings": []
    }
  },
  "validation": {
    "isValid": true,
    "warnings": []
  }
}
```

### Bulk Create (Validated)
```http
POST /api/table-data/bulk
Content-Type: application/json

{
  "machineId": "507f1f77bcf86cd799439012",
  "orderId": "507f1f77bcf86cd799439014",
  "productSpecId": "507f1f77bcf86cd799439013",
  "rows": [
    { "width": 300, "height": 400, "thickness": 50 },
    { "width": 350, "height": 450, "thickness": 60 },
    // ... up to 1000 rows
  ]
}

Response:
{
  "success": true,
  "data": {
    "created": 2,
    "failed": 0,
    "invalidRows": []  // Only present if there are failures
  }
}
```

### Get Data with Aggregations
```http
GET /api/table-data/aggregations?orderId={orderId}&machineId={machineId}

Response:
{
  "success": true,
  "data": {
    "rows": [...],
    "aggregations": {
      "area": {
        "sum": 5000000,
        "avg": 125000,
        "min": 100000,
        "max": 150000,
        "count": 40
      },
      "production_rate": { ... }
    },
    "summary": {
      "totalRows": 40,
      "machines": 2
    }
  }
}
```

### Update Row (Validated)
```http
PUT /api/table-data/{id}/validated
Content-Type: application/json

{
  "rowData": {
    "width": 320,
    "height": 420,
    "thickness": 55
  }
}
```

## 👷 Operator Assignment

### Assign Operator to Machine
```http
POST /api/operator-assignment
Content-Type: application/json

{
  "machineId": "507f1f77bcf86cd799439012",
  "operatorId": "507f1f77bcf86cd799439015",
  "skillLevel": "intermediate",
  "notes": "Trained on this machine type"
}
```

### Get Machines for Operator
```http
GET /api/operator-assignment/operator/{operatorId}

Response:
{
  "success": true,
  "data": [
    {
      "id": "...",
      "machineName": "Machine A",
      "machineType": { "type": "Extruder" },
      "status": "running",
      "skillLevel": "intermediate",
      "assignedAt": "2025-11-12T..."
    }
  ]
}
```

### Get Operators for Machine
```http
GET /api/operator-assignment/machine/{machineId}
```

### Update Assignment
```http
PUT /api/operator-assignment/{id}
Content-Type: application/json

{
  "skillLevel": "expert",
  "isActive": true
}
```

### Unassign Operator
```http
DELETE /api/operator-assignment/{id}
```

## 📐 Plastic Bag Calculation

### Single Calculation
```http
POST /api/calculate/plastic
Content-Type: application/json

{
  "width": 300,
  "height": 400,
  "thickness": 50,
  "bottomGusset": 80,
  "flap": 50,
  "airHole": 6,
  "density": 0.92,
  "totalPieces": 10000,
  "printOption": "single_side",
  "wastagePercentage": 5
}

Response:
{
  "success": true,
  "data": {
    "dimensions": {
      "width": 300,
      "height": 400,
      "thickness": 50,
      "bottomGusset": 80,
      "flap": 50,
      "airHole": 6,
      "filmLength": 1060,
      "filmWidth": 380
    },
    "weights": {
      "netWeightPerPiece": 18.47,
      "wastagePerPiece": 0.92,
      "grossWeightPerPiece": 19.39,
      "totalNetWeight": 184700,
      "totalWastage": 9235,
      "totalGrossWeight": 193935,
      "totalNetWeightKg": 184.7,
      "totalWastageKg": 9.235,
      "totalGrossWeightKg": 193.935
    },
    "areas": {
      "grossArea": 40280,
      "airHoleArea": 28.27,
      "netArea": 40251.73,
      "printingArea": 12000
    },
    "efficiency": {
      "materialEfficiency": 95.24,
      "wastagePercentage": 5
    },
    "costs": {
      "materialCostPerPiece": 1.94,
      "totalMaterialCost": 19393.5,
      "currency": "USD"
    },
    "metadata": {
      "totalPieces": 10000,
      "density": 0.92,
      "printOption": "single_side",
      "calculatedAt": "2025-11-12T..."
    }
  }
}
```

### Batch Calculation
```http
POST /api/calculate/plastic/batch
Content-Type: application/json

{
  "variations": [
    {
      "width": 300,
      "height": 400,
      "thickness": 50,
      "density": 0.92,
      "totalPieces": 5000,
      "wastagePercentage": 5
    },
    {
      "width": 350,
      "height": 450,
      "thickness": 60,
      "density": 0.92,
      "totalPieces": 5000,
      "wastagePercentage": 5
    }
  ]
}

Response:
{
  "success": true,
  "data": {
    "variations": [
      {
        "variationIndex": 0,
        "input": {...},
        "output": {...}
      },
      {
        "variationIndex": 1,
        "input": {...},
        "output": {...}
      }
    ],
    "totals": {
      "totalPieces": 10000,
      "totalNetWeightKg": 250.5,
      "totalGrossWeightKg": 263.025,
      "totalMaterialCost": 26302.5
    }
  }
}
```

## 🧮 Formula Management

### Create Formula
```http
POST /api/formula
Content-Type: application/json

{
  "name": "Plastic Weight Calculation",
  "category": "weight_calculations",
  "description": "Calculate plastic weight based on dimensions",
  "formula": "length * width * thickness * density / 1000000",
  "variables": [
    {
      "name": "length",
      "type": "number",
      "unit": "mm",
      "description": "Length in millimeters",
      "required": true,
      "min": 0,
      "max": 10000
    },
    {
      "name": "width",
      "type": "number",
      "unit": "mm",
      "required": true
    },
    {
      "name": "thickness",
      "type": "number",
      "unit": "micron",
      "required": true
    },
    {
      "name": "density",
      "type": "number",
      "unit": "g/cm³",
      "defaultValue": 0.92,
      "required": false
    }
  ],
  "constants": {
    "PI": 3.14159,
    "WASTAGE_FACTOR": 1.05
  },
  "validationRules": [
    {
      "field": "thickness",
      "rule": "range",
      "value": [10, 1000],
      "message": "Thickness must be between 10 and 1000 microns"
    }
  ],
  "branchId": "507f1f77bcf86cd799439011"
}
```

### Get All Formulas
```http
GET /api/formula?branchId={branchId}&category={category}&isActive=true
```

### Get Formula by ID
```http
GET /api/formula/{id}
```

### Update Formula
```http
PUT /api/formula/{id}
Content-Type: application/json

{
  "description": "Updated description",
  "isActive": true
}
```

### Delete Formula
```http
DELETE /api/formula/{id}
```

## 🔑 Common Query Parameters

- `branchId` - Filter by branch (24 char ObjectId)
- `isActive` - Filter by active status (true/false)
- `limit` - Limit results (max 1000)
- `offset` - Pagination offset
- `startDate` - Filter by date range start
- `endDate` - Filter by date range end

## ⚠️ Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "width",
      "message": "Width must be a positive number"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Product Spec not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Database connection failed"
}
```

## 🎯 Role-Based Access

| Endpoint | Admin | Manager | Operator |
|----------|-------|---------|----------|
| Create ProductSpec | ✅ | ✅ | ❌ |
| View ProductSpec | ✅ | ✅ | ✅ |
| Update ProductSpec | ✅ | ✅ | ❌ |
| Delete ProductSpec | ✅ | ❌ | ❌ |
| Create Config | ✅ | ✅ | ❌ |
| Create Table Data | ✅ | ✅ | ✅ |
| View Table Data | ✅ | ✅ | ✅ |
| Calculate Plastic | ✅ | ✅ | ✅ |
| Assign Operator | ✅ | ✅ | ❌ |

## 📝 Notes

- All IDs are 24-character MongoDB ObjectIds
- Timestamps are in ISO 8601 format
- All numeric values use standard units (mm, micron, g/cm³, etc.)
- Maximum bulk insert: 1000 rows per request
- Formula expressions use JavaScript math syntax
- Dimension data types: string, number, boolean, date
- Skill levels: beginner, intermediate, expert
- Print options: single_side, double_side, none
