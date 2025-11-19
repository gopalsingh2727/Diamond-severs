# Formula & Calculation System - API Summary

Complete CRUD operations for the Formula Storage and Calculation Engine modules.

---

## Quick Reference

### Formula Management APIs (7 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/formula` | Create new formula | Admin, Manager |
| GET | `/formula` | Get all formulas | Admin, Manager |
| GET | `/formula/{name}` | Get specific formula | Admin, Manager |
| PUT | `/formula/{name}` | Update formula | Admin, Manager |
| DELETE | `/formula/{name}` | Delete formula | **Admin only** |
| POST | `/formula/{name}/test` | Test formula with parameters | Admin, Manager |
| POST | `/formula/batch` | Batch create formulas | **Admin only** |

### Calculation Engine APIs (15 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/calculation/link/producttype` | Link product type to formula | Admin, Manager |
| POST | `/calculation/link/materialtype` | Link material type to formula | Admin, Manager |
| POST | `/calculation/order` | Calculate for order | Admin, Manager |
| POST | `/calculation/mixmaterials` | Calculate mix materials | Admin, Manager |
| POST | `/calculation/productspec` | Calculate from product spec | Admin, Manager |
| GET | `/calculation/producttype/{id}/formula` | Get product type formula | Admin, Manager |
| GET | `/calculation/materialtype/{id}/formula` | Get material type formula | Admin, Manager |
| GET | `/calculation/producttype/formulas` | List all product type formulas | Admin, Manager |
| GET | `/calculation/materialtype/formulas` | List all material type formulas | Admin, Manager |
| DELETE | `/calculation/producttype/{id}/unlink` | Unlink product type formula | **Admin only** |
| DELETE | `/calculation/materialtype/{id}/unlink` | Unlink material type formula | **Admin only** |
| GET | `/calculation/history?limit=50` | Get calculation history | Admin, Manager |
| GET | `/calculation/history/order/{orderId}` | Get order calculation history | Admin, Manager |
| GET | `/calculation/config/export` | Export configuration | **Admin only** |
| POST | `/calculation/config/import` | Import configuration | **Admin only** |

---

## Common Use Cases

### 1. Create and Test a Formula

```bash
# Step 1: Create formula
curl -X POST https://api.com/formula \
  -H "x-api-key: YOUR_KEY" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "formulaName": "bagWeight",
    "functionBody": "return params.length * params.width * params.thickness * params.density;",
    "metadata": {
      "description": "Calculate bag weight",
      "unit": "grams"
    }
  }'

# Step 2: Test the formula
curl -X POST https://api.com/formula/bagWeight/test \
  -H "x-api-key: YOUR_KEY" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "length": 30,
      "width": 20,
      "thickness": 0.05,
      "density": 0.92
    }
  }'
```

### 2. Link Formula and Calculate

```bash
# Step 1: Link formula to product type
curl -X POST https://api.com/calculation/link/producttype \
  -H "x-api-key: YOUR_KEY" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productTypeId": "507f1f77bcf86cd799439011",
    "formulaName": "bagWeight"
  }'

# Step 2: Calculate for an order
curl -X POST https://api.com/calculation/order \
  -H "x-api-key: YOUR_KEY" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "507f1f77bcf86cd799439033",
    "productTypeId": "507f1f77bcf86cd799439011",
    "parameters": {
      "length": 30,
      "width": 20,
      "thickness": 0.05,
      "density": 0.92
    }
  }'
```

### 3. Backup and Restore Configuration

```bash
# Export configuration
curl -X GET https://api.com/calculation/config/export \
  -H "x-api-key: YOUR_KEY" \
  -H "Authorization: Bearer TOKEN" \
  > config_backup.json

# Import configuration
curl -X POST https://api.com/calculation/config/import \
  -H "x-api-key: YOUR_KEY" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d @config_backup.json
```

---

## Integration with Existing System

### With Product Spec API

```javascript
// Get product spec with dimensions
const productSpec = await getProductSpec(specId);

// Calculate using spec dimensions
const result = await axios.post('https://api.com/calculation/productspec', {
  productTypeId: productSpec.productTypeId,
  dimensions: productSpec.dimensions,
  additionalParams: { wasteFactor: 1.05 }
});

console.log('Calculated weight:', result.data.calculation.result);
```

### With Order Creation

```javascript
// When creating an order, auto-calculate weight
const createOrder = async (orderData) => {
  // Create order
  const order = await Order.create(orderData);

  // Calculate weight using linked formula
  const calculation = await axios.post('https://api.com/calculation/order', {
    orderId: order._id,
    productTypeId: order.productTypeId,
    parameters: {
      length: orderData.length,
      width: orderData.width,
      thickness: orderData.thickness,
      density: orderData.density
    }
  });

  // Update order with calculated weight
  order.materialWeight = calculation.data.calculation.result;
  await order.save();

  return order;
};
```

---

## Formula Examples Library

### Plastic Bag Weight

```javascript
// Simple rectangular bag
{
  "formulaName": "rectangularBagWeight",
  "functionBody": "const area = params.length * params.width * 2; const volume = area * params.thickness; return volume * params.density;",
  "metadata": {
    "description": "Calculate rectangular bag weight (both sides)",
    "requiredParams": ["length", "width", "thickness", "density"],
    "unit": "grams"
  }
}

// Gusseted bag
{
  "formulaName": "gussettedBagWeight",
  "functionBody": "const mainArea = params.length * params.width * 2; const gussetArea = params.gusset * params.length * 2; const totalArea = mainArea + gussetArea; return totalArea * params.thickness * params.density;",
  "metadata": {
    "description": "Calculate gusseted bag weight",
    "requiredParams": ["length", "width", "gusset", "thickness", "density"],
    "unit": "grams"
  }
}
```

### Container Volume

```javascript
// Cylindrical container
{
  "formulaName": "cylindricalContainerVolume",
  "functionBody": "const radius = params.diameter / 2; const wallArea = Math.PI * params.diameter * params.height; const bottomArea = Math.PI * radius * radius; return (wallArea + bottomArea) * params.thickness * params.density;",
  "metadata": {
    "description": "Calculate cylindrical container weight",
    "requiredParams": ["diameter", "height", "thickness", "density"],
    "unit": "grams"
  }
}
```

### Multi-Layer Film

```javascript
// Multi-layer calculation
{
  "formulaName": "multiLayerFilm",
  "functionBody": "let totalWeight = 0; for (let i = 0; i < params.layers.length; i++) { const layer = params.layers[i]; const layerVolume = params.area * layer.thickness; totalWeight += layerVolume * layer.density; } return totalWeight;",
  "metadata": {
    "description": "Calculate multi-layer film weight",
    "requiredParams": ["area", "layers"],
    "unit": "grams",
    "note": "layers should be array of {thickness, density} objects"
  }
}
```

---

## Error Codes Reference

| Status | Message | Solution |
|--------|---------|----------|
| 400 | Invalid function body | Check JavaScript syntax in functionBody |
| 400 | Formula calculation failed | Verify parameters match formula requirements |
| 401 | Invalid API key | Check x-api-key header |
| 401 | Invalid token | Refresh authentication token |
| 403 | Unauthorized | Check user role (some endpoints require Admin) |
| 404 | Formula not found | Verify formula name exists |
| 404 | Product type not found | Check productTypeId is valid |
| 404 | No formula linked | Link formula to product/material type first |

---

## Testing Checklist

- [ ] Create a formula
- [ ] Test formula with sample data
- [ ] Update formula
- [ ] Get formula details
- [ ] Link formula to product type
- [ ] Calculate for an order
- [ ] View calculation history
- [ ] Export configuration
- [ ] Import configuration
- [ ] Delete formula (admin)

---

## Files Created

### Modules
- `/models/calculatePlastic/formulaStorage.js` - Formula storage engine
- `/models/calculatePlastic/calculationEngine.js` - Calculation execution engine
- `/models/calculatePlastic/README.md` - Module documentation

### API Handlers
- `/handlers/formula/formula.js` - Formula CRUD operations (7 endpoints)
- `/handlers/calculation/calculation.js` - Calculation operations (15 endpoints)
- `/handlers/formula/README.md` - Complete API documentation

### Routes
- `/ymlFile/Formula/Formula.yml` - Formula routes
- `/ymlFile/Calculation/Calculation.yml` - Calculation routes
- Updated `/ymlFile/index.yml` - Main route configuration

---

## Security Notes

1. **Function Execution**: Formulas are executed using `new Function()`. In production, consider:
   - Sandboxing execution environment
   - Setting execution timeouts
   - Limiting available operations

2. **Admin-Only Operations**:
   - Delete formula
   - Batch create formulas
   - Unlink formulas
   - Export/import configuration

3. **Input Validation**: All endpoints validate:
   - API key presence
   - JWT token validity
   - User role permissions
   - Required parameters

---

## Performance Considerations

1. **Calculation History**: Limited to 1000 entries by default
2. **Formula Storage**: In-memory Map (consider database persistence for production)
3. **Caching**: Implement caching for frequent calculations
4. **Batch Operations**: Use batch endpoints for multiple formulas

---

## Next Steps

1. **Database Persistence**: Store formulas in MongoDB for persistence across restarts
2. **Formula Versioning**: Track formula changes over time
3. **Validation Rules**: Add parameter validation to formulas
4. **UI Integration**: Create frontend interface for formula management
5. **Testing Suite**: Add automated tests for formulas
6. **Monitoring**: Add logging and monitoring for calculations

---

**System Ready**: All 22 CRUD endpoints are live and ready to use!

**Documentation**: See [Formula & Calculation API README](../handlers/formula/README.md) for detailed endpoint documentation.

**Module Documentation**: See [Formula Storage & Calculation Engine README](README.md) for module usage guide.
