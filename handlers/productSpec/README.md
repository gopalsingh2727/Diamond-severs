# Product Spec API Documentation

## Overview

The Product Spec API allows you to create, manage, and configure product specifications with custom dimensions for different product types. Each product spec can be activated or deactivated as needed.

## Base URL

```
https://your-api-domain.com/
```

## Authentication

All endpoints require:
- **API Key**: `x-api-key` header
- **Authorization**: `Bearer <token>` header
- **User Role**: Admin or Manager

## Endpoints

### 1. Create Product Spec

Create a new product specification.

**Endpoint:** `POST /productspec`

**Headers:**
```
x-api-key: YOUR_API_KEY
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "productTypeId": "507f1f77bcf86cd799439011",
  "specName": "LDPE Bag 30x20",
  "description": "Low-density polyethylene bag specification",
  "dimensions": [
    {
      "name": "length",
      "value": 30,
      "unit": "cm",
      "dataType": "number"
    },
    {
      "name": "width",
      "value": 20,
      "unit": "cm",
      "dataType": "number"
    },
    {
      "name": "thickness",
      "value": 0.05,
      "unit": "mm",
      "dataType": "number"
    },
    {
      "name": "color",
      "value": "transparent",
      "unit": "",
      "dataType": "string"
    }
  ],
  "branchId": "507f1f77bcf86cd799439012"
}
```

**Response:** `201 Created`
```json
{
  "message": "Product spec created successfully",
  "productSpec": {
    "_id": "507f1f77bcf86cd799439013",
    "productTypeId": {
      "_id": "507f1f77bcf86cd799439011",
      "productTypeName": "Plastic Bag"
    },
    "specName": "LDPE Bag 30x20",
    "description": "Low-density polyethylene bag specification",
    "dimensions": [...],
    "branchId": {...},
    "isActive": true,
    "createdAt": "2024-11-11T10:00:00.000Z",
    "updatedAt": "2024-11-11T10:00:00.000Z"
  }
}
```

---

### 2. Get All Product Specs

Retrieve all product specifications.

**Endpoint:** `GET /productspec`

**Query Parameters:**
- `productTypeId` (optional): Filter by product type
- `isActive` (optional): Filter by active status (`true` or `false`)

**Examples:**
```
GET /productspec
GET /productspec?isActive=true
GET /productspec?productTypeId=507f1f77bcf86cd799439011
GET /productspec?productTypeId=507f1f77bcf86cd799439011&isActive=true
```

**Headers:**
```
x-api-key: YOUR_API_KEY
Authorization: Bearer YOUR_TOKEN
```

**Response:** `200 OK`
```json
{
  "message": "Product specs fetched successfully",
  "count": 5,
  "productSpecs": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "productTypeId": {
        "_id": "507f1f77bcf86cd799439011",
        "productTypeName": "Plastic Bag"
      },
      "specName": "LDPE Bag 30x20",
      "description": "Low-density polyethylene bag specification",
      "dimensions": [...],
      "branchId": {...},
      "isActive": true,
      "createdAt": "2024-11-11T10:00:00.000Z",
      "updatedAt": "2024-11-11T10:00:00.000Z"
    },
    // ... more specs
  ]
}
```

---

### 3. Get Product Spec by ID

Retrieve a specific product specification.

**Endpoint:** `GET /productspec/{id}`

**Example:**
```
GET /productspec/507f1f77bcf86cd799439013
```

**Headers:**
```
x-api-key: YOUR_API_KEY
Authorization: Bearer YOUR_TOKEN
```

**Response:** `200 OK`
```json
{
  "message": "Product spec fetched successfully",
  "productSpec": {
    "_id": "507f1f77bcf86cd799439013",
    "productTypeId": {
      "_id": "507f1f77bcf86cd799439011",
      "productTypeName": "Plastic Bag"
    },
    "specName": "LDPE Bag 30x20",
    "description": "Low-density polyethylene bag specification",
    "dimensions": [
      {
        "name": "length",
        "value": 30,
        "unit": "cm",
        "dataType": "number"
      },
      {
        "name": "width",
        "value": 20,
        "unit": "cm",
        "dataType": "number"
      }
    ],
    "branchId": {...},
    "isActive": true,
    "createdAt": "2024-11-11T10:00:00.000Z",
    "updatedAt": "2024-11-11T10:00:00.000Z"
  }
}
```

---

### 4. Update Product Spec

Update an existing product specification.

**Endpoint:** `PUT /productspec/{id}`

**Example:**
```
PUT /productspec/507f1f77bcf86cd799439013
```

**Headers:**
```
x-api-key: YOUR_API_KEY
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Request Body:** (all fields optional)
```json
{
  "specName": "LDPE Bag 30x20 Updated",
  "description": "Updated description",
  "dimensions": [
    {
      "name": "length",
      "value": 35,
      "unit": "cm",
      "dataType": "number"
    },
    {
      "name": "width",
      "value": 25,
      "unit": "cm",
      "dataType": "number"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "message": "Product spec updated successfully",
  "productSpec": {
    "_id": "507f1f77bcf86cd799439013",
    "specName": "LDPE Bag 30x20 Updated",
    "description": "Updated description",
    "dimensions": [...],
    // ... other fields
  }
}
```

---

### 5. Delete Product Spec

Delete a product specification.

**Endpoint:** `DELETE /productspec/{id}`

**Example:**
```
DELETE /productspec/507f1f77bcf86cd799439013
```

**Headers:**
```
x-api-key: YOUR_API_KEY
Authorization: Bearer YOUR_TOKEN
```

**Response:** `200 OK`
```json
{
  "message": "Product spec deleted successfully"
}
```

---

### 6. Activate Product Spec

Activate an inactive product specification.

**Endpoint:** `PATCH /productspec/{id}/activate`

**Example:**
```
PATCH /productspec/507f1f77bcf86cd799439013/activate
```

**Headers:**
```
x-api-key: YOUR_API_KEY
Authorization: Bearer YOUR_TOKEN
```

**Response:** `200 OK`
```json
{
  "message": "Product spec activated successfully",
  "productSpec": {
    "_id": "507f1f77bcf86cd799439013",
    "specName": "LDPE Bag 30x20",
    "isActive": true,
    // ... other fields
  }
}
```

**Error Response:** `400 Bad Request` (if already active)
```json
{
  "message": "Product spec is already active"
}
```

---

### 7. Deactivate Product Spec

Deactivate an active product specification.

**Endpoint:** `PATCH /productspec/{id}/deactivate`

**Example:**
```
PATCH /productspec/507f1f77bcf86cd799439013/deactivate
```

**Headers:**
```
x-api-key: YOUR_API_KEY
Authorization: Bearer YOUR_TOKEN
```

**Response:** `200 OK`
```json
{
  "message": "Product spec deactivated successfully",
  "productSpec": {
    "_id": "507f1f77bcf86cd799439013",
    "specName": "LDPE Bag 30x20",
    "isActive": false,
    // ... other fields
  }
}
```

**Error Response:** `400 Bad Request` (if already inactive)
```json
{
  "message": "Product spec is already inactive"
}
```

---

### 8. Get Product Specs by Product Type

Retrieve all product specifications for a specific product type.

**Endpoint:** `GET /productspec/producttype/{productTypeId}`

**Query Parameters:**
- `isActive` (optional): Filter by active status (`true` or `false`)

**Examples:**
```
GET /productspec/producttype/507f1f77bcf86cd799439011
GET /productspec/producttype/507f1f77bcf86cd799439011?isActive=true
```

**Headers:**
```
x-api-key: YOUR_API_KEY
Authorization: Bearer YOUR_TOKEN
```

**Response:** `200 OK`
```json
{
  "message": "Product specs fetched successfully",
  "count": 3,
  "productSpecs": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "productTypeId": {
        "_id": "507f1f77bcf86cd799439011",
        "productTypeName": "Plastic Bag"
      },
      "specName": "LDPE Bag 30x20",
      "dimensions": [...],
      "isActive": true,
      // ... other fields
    },
    // ... more specs
  ]
}
```

---

## Data Types for Dimensions

The `dimensions` array supports the following data types:

- **`number`**: Numeric values (e.g., 30, 0.05, 100.5)
- **`string`**: Text values (e.g., "transparent", "blue", "oval")
- **`boolean`**: True/false values (e.g., true, false)
- **`date`**: Date values (e.g., "2024-11-11T10:00:00.000Z")

**Example dimensions array:**
```json
{
  "dimensions": [
    { "name": "length", "value": 30, "unit": "cm", "dataType": "number" },
    { "name": "width", "value": 20, "unit": "cm", "dataType": "number" },
    { "name": "thickness", "value": 0.05, "unit": "mm", "dataType": "number" },
    { "name": "color", "value": "blue", "unit": "", "dataType": "string" },
    { "name": "isPrintable", "value": true, "unit": "", "dataType": "boolean" },
    { "name": "expiryDate", "value": "2025-12-31", "unit": "", "dataType": "date" }
  ]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "productTypeId and specName are required"
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
  "message": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "message": "Product spec not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Error message details"
}
```

---

## Role-Based Access

### Admin
- Can create, read, update, delete, activate, and deactivate product specs across all branches
- Must specify `branchId` when creating a product spec

### Manager
- Can create, read, update, delete, activate, and deactivate product specs only within their assigned branch
- `branchId` is automatically set to their branch

---

## Usage Examples

### Example 1: Create a Plastic Bag Spec

```javascript
const axios = require('axios');

const createBagSpec = async () => {
  try {
    const response = await axios.post(
      'https://your-api.com/productspec',
      {
        productTypeId: '507f1f77bcf86cd799439011',
        specName: 'HDPE Shopping Bag Medium',
        description: 'High-density polyethylene shopping bag',
        dimensions: [
          { name: 'length', value: 40, unit: 'cm', dataType: 'number' },
          { name: 'width', value: 30, unit: 'cm', dataType: 'number' },
          { name: 'gusset', value: 10, unit: 'cm', dataType: 'number' },
          { name: 'thickness', value: 0.04, unit: 'mm', dataType: 'number' },
          { name: 'handleType', value: 'loop', unit: '', dataType: 'string' },
          { name: 'printable', value: true, unit: '', dataType: 'boolean' }
        ],
        branchId: '507f1f77bcf86cd799439012'
      },
      {
        headers: {
          'x-api-key': 'YOUR_API_KEY',
          'Authorization': 'Bearer YOUR_TOKEN',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Created:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};
```

### Example 2: Get Active Specs for a Product Type

```javascript
const getActiveSpecs = async (productTypeId) => {
  try {
    const response = await axios.get(
      `https://your-api.com/productspec/producttype/${productTypeId}?isActive=true`,
      {
        headers: {
          'x-api-key': 'YOUR_API_KEY',
          'Authorization': 'Bearer YOUR_TOKEN'
        }
      }
    );

    console.log(`Found ${response.data.count} active specs`);
    return response.data.productSpecs;
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};
```

### Example 3: Deactivate a Spec

```javascript
const deactivateSpec = async (specId) => {
  try {
    const response = await axios.patch(
      `https://your-api.com/productspec/${specId}/deactivate`,
      {},
      {
        headers: {
          'x-api-key': 'YOUR_API_KEY',
          'Authorization': 'Bearer YOUR_TOKEN'
        }
      }
    );

    console.log('Deactivated:', response.data.message);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
};
```

---

## Integration with Order System

Product specs can be used when creating orders to automatically populate dimensions and specifications:

```javascript
// Get product spec
const productSpec = await getProductSpecById('507f1f77bcf86cd799439013');

// Use dimensions in order creation
const order = {
  customerId: 'customer_id',
  productTypeId: productSpec.productTypeId._id,
  productSpecId: productSpec._id,
  // Use dimensions from spec
  dimensions: productSpec.dimensions,
  quantity: 1000,
  // ... other order fields
};
```

---

## Notes

- Product spec names must be unique per product type within a branch
- Dimensions are stored as a flexible array, allowing any custom attributes
- The `isActive` field allows soft deletion - deactivated specs remain in the database but can be filtered out
- All timestamps are automatically managed by MongoDB (`createdAt`, `updatedAt`)
- Manager users can only access specs from their assigned branch
- Admin users can access specs from all branches

---

**Last Updated:** November 2024
**Version:** 1.0.0
