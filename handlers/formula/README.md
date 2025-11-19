# Formula & Calculation Engine API Documentation

Complete API documentation for managing custom formulas and performing calculations in your order management system.

---

## Table of Contents

1. [Formula Management API](#formula-management-api)
2. [Calculation Engine API](#calculation-engine-api)
3. [Integration Examples](#integration-examples)
4. [Best Practices](#best-practices)

---

# Formula Management API

Manage custom calculation formulas for your business.

## Base Authentication

All endpoints require:
- **API Key**: `x-api-key` header
- **Authorization**: `Bearer <token>` header
- **User Role**: Admin or Manager (unless specified)

---

## 1. Create Formula

Create a new custom formula.

**Endpoint:** `POST /formula`

**Request Body:**
```json
{
  "formulaName": "rectangularBagWeight",
  "functionBody": "const volume = params.length * params.width * params.thickness; return volume * params.density;",
  "metadata": {
    "description": "Calculate weight of rectangular plastic bag",
    "requiredParams": ["length", "width", "thickness", "density"],
    "unit": "grams",
    "category": "plastic-bags",
    "version": "1.0"
  }
}
```

**Response:** `201 Created`
```json
{
  "message": "Formula created successfully",
  "formula": {
    "name": "rectangularBagWeight",
    "metadata": {
      "description": "Calculate weight of rectangular plastic bag",
      "requiredParams": ["length", "width", "thickness", "density"],
      "unit": "grams",
      "category": "plastic-bags",
      "version": "1.0",
      "createdBy": "John Doe",
      "createdByRole": "admin",
      "functionBody": "const volume = params.length * params.width * params.thickness; return volume * params.density;",
      "createdAt": "2024-11-11T10:00:00.000Z",
      "lastModified": "2024-11-11T10:00:00.000Z"
    }
  }
}
```

**Formula Function Guidelines:**
- Must be a valid JavaScript expression
- Access parameters via `params` object
- Must return a numeric value
- Can use JavaScript built-in functions (Math, etc.)

**Examples of Valid Function Bodies:**

```javascript
// Simple calculation
"return params.a + params.b;"

// With Math functions
"return Math.PI * params.radius * params.radius * params.height;"

// Multi-line with variables
"const area = params.length * params.width; const volume = area * params.thickness; return volume * params.density * 1.05;"

// Conditional logic
"if (params.quantity > 1000) { return params.basePrice * 0.9; } else { return params.basePrice; }"
```

---

## 2. Get All Formulas

Retrieve all available formulas.

**Endpoint:** `GET /formula`

**Response:** `200 OK`
```json
{
  "message": "Formulas fetched successfully",
  "count": 3,
  "formulas": [
    {
      "name": "rectangularBagWeight",
      "metadata": {...},
      "exists": true
    },
    {
      "name": "cylindricalContainerVolume",
      "metadata": {...},
      "exists": true
    }
  ]
}
```

---

## 3. Get Formula by Name

Retrieve a specific formula by name.

**Endpoint:** `GET /formula/{name}`

**Example:** `GET /formula/rectangularBagWeight`

**Response:** `200 OK`
```json
{
  "message": "Formula fetched successfully",
  "formula": {
    "name": "rectangularBagWeight",
    "metadata": {
      "description": "Calculate weight of rectangular plastic bag",
      "requiredParams": ["length", "width", "thickness", "density"],
      "unit": "grams",
      "functionBody": "const volume = params.length * params.width * params.thickness; return volume * params.density;",
      "createdBy": "John Doe",
      "createdByRole": "admin",
      "createdAt": "2024-11-11T10:00:00.000Z"
    }
  }
}
```

---

## 4. Update Formula

Update an existing formula.

**Endpoint:** `PUT /formula/{name}`

**Example:** `PUT /formula/rectangularBagWeight`

**Request Body:** (all fields optional)
```json
{
  "functionBody": "const volume = params.length * params.width * params.thickness; const wasteFactor = params.wasteFactor || 1.05; return volume * params.density * wasteFactor;",
  "metadata": {
    "description": "Calculate weight with waste factor",
    "requiredParams": ["length", "width", "thickness", "density"],
    "optionalParams": ["wasteFactor"],
    "version": "2.0"
  }
}
```

**Response:** `200 OK`
```json
{
  "message": "Formula updated successfully",
  "formula": {
    "name": "rectangularBagWeight",
    "metadata": {...}
  }
}
```

---

## 5. Delete Formula

Delete a formula. **Admin only**.

**Endpoint:** `DELETE /formula/{name}`

**Example:** `DELETE /formula/rectangularBagWeight`

**Response:** `200 OK`
```json
{
  "message": "Formula deleted successfully",
  "deletedFormula": "rectangularBagWeight"
}
```

---

## 6. Test Formula

Test a formula with sample parameters.

**Endpoint:** `POST /formula/{name}/test`

**Example:** `POST /formula/rectangularBagWeight/test`

**Request Body:**
```json
{
  "parameters": {
    "length": 30,
    "width": 20,
    "thickness": 0.05,
    "density": 0.92
  }
}
```

**Response:** `200 OK`
```json
{
  "message": "Formula calculation successful",
  "formula": "rectangularBagWeight",
  "parameters": {
    "length": 30,
    "width": 20,
    "thickness": 0.05,
    "density": 0.92
  },
  "result": 27.6,
  "calculatedAt": "2024-11-11T10:30:00.000Z"
}
```

---

## 7. Batch Create Formulas

Create multiple formulas at once. **Admin only**.

**Endpoint:** `POST /formula/batch`

**Request Body:**
```json
{
  "formulas": [
    {
      "formulaName": "formula1",
      "functionBody": "return params.a + params.b;",
      "metadata": {
        "description": "Simple addition"
      }
    },
    {
      "formulaName": "formula2",
      "functionBody": "return params.x * params.y;",
      "metadata": {
        "description": "Simple multiplication"
      }
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "message": "Batch creation completed: 2 succeeded, 0 failed",
  "totalProcessed": 2,
  "successCount": 2,
  "failureCount": 0,
  "results": [
    {
      "name": "formula1",
      "success": true,
      "message": "Formula created successfully"
    },
    {
      "name": "formula2",
      "success": true,
      "message": "Formula created successfully"
    }
  ]
}
```

---

# Calculation Engine API

Execute calculations and link formulas to product/material types.

---

## 1. Link Product Type to Formula

Associate a product type with a calculation formula.

**Endpoint:** `POST /calculation/link/producttype`

**Request Body:**
```json
{
  "productTypeId": "507f1f77bcf86cd799439011",
  "formulaName": "rectangularBagWeight",
  "options": {
    "autoCalculate": true,
    "precision": 2
  }
}
```

**Response:** `201 Created`
```json
{
  "message": "Product type linked to formula successfully",
  "link": {
    "productTypeId": "507f1f77bcf86cd799439011",
    "productTypeName": "Plastic Bag",
    "formulaName": "rectangularBagWeight",
    "options": {
      "autoCalculate": true,
      "precision": 2
    }
  }
}
```

---

## 2. Link Material Type to Formula

Associate a material type with a calculation formula.

**Endpoint:** `POST /calculation/link/materialtype`

**Request Body:**
```json
{
  "materialTypeId": "507f1f77bcf86cd799439022",
  "formulaName": "materialDensityCalc",
  "options": {
    "defaultUnit": "kg"
  }
}
```

**Response:** `201 Created`
```json
{
  "message": "Material type linked to formula successfully",
  "link": {
    "materialTypeId": "507f1f77bcf86cd799439022",
    "materialTypeName": "LDPE",
    "formulaName": "materialDensityCalc",
    "options": {
      "defaultUnit": "kg"
    }
  }
}
```

---

## 3. Calculate for Order

Execute calculation for an order based on linked formulas.

**Endpoint:** `POST /calculation/order`

**Request Body:**
```json
{
  "orderId": "507f1f77bcf86cd799439033",
  "productTypeId": "507f1f77bcf86cd799439011",
  "parameters": {
    "length": 30,
    "width": 20,
    "thickness": 0.05,
    "density": 0.92
  }
}
```

**Response:** `200 OK`
```json
{
  "message": "Calculation completed successfully",
  "calculation": {
    "success": true,
    "result": 27.6,
    "formulaUsed": "rectangularBagWeight",
    "sourceType": "productType",
    "calculatedAt": "2024-11-11T11:00:00.000Z"
  }
}
```

---

## 4. Calculate Mix Materials

Calculate weights for mixed material orders.

**Endpoint:** `POST /calculation/mixmaterials`

**Request Body:**
```json
{
  "orderId": "507f1f77bcf86cd799439033",
  "mixMaterials": [
    {
      "materialTypeId": "507f1f77bcf86cd799439022",
      "ratio": 0.7,
      "parameters": {
        "volume": 1000,
        "density": 0.92
      }
    },
    {
      "materialTypeId": "507f1f77bcf86cd799439023",
      "ratio": 0.3,
      "parameters": {
        "volume": 1000,
        "density": 0.95
      }
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "message": "Mix materials calculation completed successfully",
  "calculation": {
    "orderId": "507f1f77bcf86cd799439033",
    "totalWeight": 929,
    "materials": [
      {
        "materialTypeId": "507f1f77bcf86cd799439022",
        "formulaUsed": "materialDensityCalc",
        "baseWeight": 920,
        "ratio": 0.7,
        "adjustedWeight": 644,
        "unit": "grams"
      },
      {
        "materialTypeId": "507f1f77bcf86cd799439023",
        "formulaUsed": "materialDensityCalc",
        "baseWeight": 950,
        "ratio": 0.3,
        "adjustedWeight": 285,
        "unit": "grams"
      }
    ],
    "calculatedAt": "2024-11-11T11:15:00.000Z"
  }
}
```

---

## 5. Calculate from Product Spec

Calculate based on product specification dimensions.

**Endpoint:** `POST /calculation/productspec`

**Request Body:**
```json
{
  "productTypeId": "507f1f77bcf86cd799439011",
  "dimensions": [
    { "name": "length", "value": 30 },
    { "name": "width", "value": 20 },
    { "name": "thickness", "value": 0.05 }
  ],
  "additionalParams": {
    "density": 0.92,
    "wasteFactor": 1.05
  }
}
```

**Response:** `200 OK`
```json
{
  "message": "Product spec calculation completed successfully",
  "calculation": {
    "success": true,
    "result": 28.98,
    "formulaUsed": "rectangularBagWeight",
    "parameters": {
      "length": 30,
      "width": 20,
      "thickness": 0.05,
      "density": 0.92,
      "wasteFactor": 1.05
    },
    "calculatedAt": "2024-11-11T11:20:00.000Z"
  }
}
```

---

## 6. Get Product Type Formula

Get the formula linked to a product type.

**Endpoint:** `GET /calculation/producttype/{productTypeId}/formula`

**Example:** `GET /calculation/producttype/507f1f77bcf86cd799439011/formula`

**Response:** `200 OK`
```json
{
  "message": "Product type formula fetched successfully",
  "productTypeId": "507f1f77bcf86cd799439011",
  "productTypeName": "Plastic Bag",
  "formula": {
    "formulaName": "rectangularBagWeight",
    "linkedAt": "2024-11-11T10:00:00.000Z",
    "autoCalculate": true,
    "precision": 2
  }
}
```

---

## 7. Get Material Type Formula

Get the formula linked to a material type.

**Endpoint:** `GET /calculation/materialtype/{materialTypeId}/formula`

**Example:** `GET /calculation/materialtype/507f1f77bcf86cd799439022/formula`

**Response:** `200 OK`
```json
{
  "message": "Material type formula fetched successfully",
  "materialTypeId": "507f1f77bcf86cd799439022",
  "materialTypeName": "LDPE",
  "formula": {
    "formulaName": "materialDensityCalc",
    "linkedAt": "2024-11-11T10:05:00.000Z",
    "defaultUnit": "kg"
  }
}
```

---

## 8. List All Product Type Formulas

List all product type to formula mappings.

**Endpoint:** `GET /calculation/producttype/formulas`

**Response:** `200 OK`
```json
{
  "message": "Product type formulas fetched successfully",
  "count": 3,
  "formulas": [
    {
      "productTypeId": "507f1f77bcf86cd799439011",
      "productTypeName": "Plastic Bag",
      "formulaName": "rectangularBagWeight",
      "linkedAt": "2024-11-11T10:00:00.000Z"
    },
    {
      "productTypeId": "507f1f77bcf86cd799439012",
      "productTypeName": "Container",
      "formulaName": "cylindricalContainerVolume",
      "linkedAt": "2024-11-11T10:10:00.000Z"
    }
  ]
}
```

---

## 9. List All Material Type Formulas

List all material type to formula mappings.

**Endpoint:** `GET /calculation/materialtype/formulas`

**Response:** `200 OK`
```json
{
  "message": "Material type formulas fetched successfully",
  "count": 2,
  "formulas": [
    {
      "materialTypeId": "507f1f77bcf86cd799439022",
      "materialTypeName": "LDPE",
      "formulaName": "materialDensityCalc",
      "linkedAt": "2024-11-11T10:05:00.000Z"
    }
  ]
}
```

---

## 10. Unlink Product Type Formula

Remove formula link from product type. **Admin only**.

**Endpoint:** `DELETE /calculation/producttype/{productTypeId}/unlink`

**Example:** `DELETE /calculation/producttype/507f1f77bcf86cd799439011/unlink`

**Response:** `200 OK`
```json
{
  "message": "Product type formula unlinked successfully",
  "productTypeId": "507f1f77bcf86cd799439011"
}
```

---

## 11. Unlink Material Type Formula

Remove formula link from material type. **Admin only**.

**Endpoint:** `DELETE /calculation/materialtype/{materialTypeId}/unlink`

**Example:** `DELETE /calculation/materialtype/507f1f77bcf86cd799439022/unlink`

**Response:** `200 OK`
```json
{
  "message": "Material type formula unlinked successfully",
  "materialTypeId": "507f1f77bcf86cd799439022"
}
```

---

## 12. Get Calculation History

Get recent calculation history.

**Endpoint:** `GET /calculation/history?limit=50`

**Query Parameters:**
- `limit` (optional): Number of entries to return (default: 50)

**Response:** `200 OK`
```json
{
  "message": "Calculation history fetched successfully",
  "count": 10,
  "history": [
    {
      "orderId": "507f1f77bcf86cd799439033",
      "productTypeId": "507f1f77bcf86cd799439011",
      "formulaName": "rectangularBagWeight",
      "sourceType": "productType",
      "parameters": {...},
      "result": 27.6,
      "calculatedAt": "2024-11-11T11:00:00.000Z"
    }
  ]
}
```

---

## 13. Get Order Calculation History

Get calculation history for a specific order.

**Endpoint:** `GET /calculation/history/order/{orderId}`

**Example:** `GET /calculation/history/order/507f1f77bcf86cd799439033`

**Response:** `200 OK`
```json
{
  "message": "Order calculation history fetched successfully",
  "orderId": "507f1f77bcf86cd799439033",
  "count": 5,
  "history": [
    {
      "orderId": "507f1f77bcf86cd799439033",
      "formulaName": "rectangularBagWeight",
      "parameters": {...},
      "result": 27.6,
      "calculatedAt": "2024-11-11T11:00:00.000Z"
    }
  ]
}
```

---

## 14. Export Configuration

Export all formula links for backup. **Admin only**.

**Endpoint:** `GET /calculation/config/export`

**Response:** `200 OK`
```json
{
  "message": "Configuration exported successfully",
  "configuration": {
    "productTypeFormulas": [
      ["507f1f77bcf86cd799439011", {"formulaName": "rectangularBagWeight", "linkedAt": "..."}]
    ],
    "materialTypeFormulas": [
      ["507f1f77bcf86cd799439022", {"formulaName": "materialDensityCalc", "linkedAt": "..."}]
    ],
    "exportedAt": "2024-11-11T12:00:00.000Z"
  }
}
```

---

## 15. Import Configuration

Import formula links from backup. **Admin only**.

**Endpoint:** `POST /calculation/config/import`

**Request Body:**
```json
{
  "configuration": {
    "productTypeFormulas": [...],
    "materialTypeFormulas": [...]
  }
}
```

**Response:** `200 OK`
```json
{
  "message": "Configuration imported successfully"
}
```

---

# Integration Examples

## Complete Workflow Example

### Step 1: Create a Formula

```javascript
const createFormula = async () => {
  const response = await axios.post('https://api.com/formula', {
    formulaName: 'plasticBagWeight',
    functionBody: `
      const area = params.length * params.width * 2;
      const volume = area * params.thickness;
      const weight = volume * params.density;
      const wasteFactor = params.wasteFactor || 1.05;
      return weight * wasteFactor;
    `,
    metadata: {
      description: 'Calculate plastic bag weight with waste factor',
      requiredParams: ['length', 'width', 'thickness', 'density'],
      optionalParams: ['wasteFactor'],
      unit: 'grams'
    }
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${token}`
    }
  });

  return response.data;
};
```

### Step 2: Link Formula to Product Type

```javascript
const linkFormula = async (productTypeId) => {
  const response = await axios.post('https://api.com/calculation/link/producttype', {
    productTypeId: productTypeId,
    formulaName: 'plasticBagWeight',
    options: {
      autoCalculate: true,
      precision: 2
    }
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${token}`
    }
  });

  return response.data;
};
```

### Step 3: Test the Formula

```javascript
const testFormula = async () => {
  const response = await axios.post('https://api.com/formula/plasticBagWeight/test', {
    parameters: {
      length: 30,
      width: 20,
      thickness: 0.05,
      density: 0.92,
      wasteFactor: 1.05
    }
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${token}`
    }
  });

  console.log('Calculated weight:', response.data.result, 'grams');
  return response.data;
};
```

### Step 4: Calculate for an Order

```javascript
const calculateOrder = async (orderId, productTypeId) => {
  const response = await axios.post('https://api.com/calculation/order', {
    orderId: orderId,
    productTypeId: productTypeId,
    parameters: {
      length: 30,
      width: 20,
      thickness: 0.05,
      density: 0.92
    }
  }, {
    headers: {
      'x-api-key': API_KEY,
      'Authorization': `Bearer ${token}`
    }
  });

  return response.data.calculation;
};
```

---

# Best Practices

## Formula Creation

1. **Always test formulas** before linking to production data
2. **Include validation** in function body
3. **Document required parameters** in metadata
4. **Use descriptive names** for formulas
5. **Version your formulas** when making changes

## Security

1. **Sanitize inputs** - Never trust user input
2. **Limit formula complexity** - Avoid infinite loops
3. **Admin-only deletion** - Protect against accidental removal
4. **Audit trail** - Use calculation history for tracking

## Performance

1. **Cache frequent calculations** where possible
2. **Keep formulas simple** - Complex logic should be in application layer
3. **Limit history size** - Clear old history periodically
4. **Batch operations** when creating multiple formulas

## Error Handling

Always wrap API calls in try-catch:

```javascript
try {
  const result = await calculateForOrder(orderData);
  // Handle success
} catch (error) {
  if (error.response) {
    // Formula error or validation error
    console.error(error.response.data.message);
  } else {
    // Network error
    console.error('Network error:', error.message);
  }
}
```

---

**Last Updated:** November 2024
**Version:** 1.0.0
