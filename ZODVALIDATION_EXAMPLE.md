# Zod Validation Implementation Guide

This guide demonstrates how to use Zod validation in your Lambda handlers.

## What's Been Added

### 1. Zod Schemas in Models

The following models now have Zod validation schemas:
- **Branch** (`models/Branch/Branch.js`)
- **Customer** (`models/Customer/customer.js`)
- **Product** (`models/product/product.js`)
- **Machine** (`models/Machine/machine.js`)
- **Order** (`models/oders/oders.js`)

Each model exports:
- `createXSchema` - For validating new resource creation
- `updateXSchema` - For validating resource updates
- `xIdSchema` - For validating ID parameters

### 2. Validation Utility

Location: `utils/zodValidator.js`

Provides four validation functions:
- `validateRequest()` - Validates request body
- `validatePathParameters()` - Validates path parameters
- `validateQueryParameters()` - Validates query string parameters
- `validatePartialRequest()` - Validates partial data (for PATCH operations)

## Usage Examples

### Example 1: Creating a Branch (POST Request)

```javascript
// handlers/Branch/createBranch.js
const { APIGatewayProxyEvent, APIGatewayProxyResult } = require('aws-lambda');
const connectToDatabase = require('../../config/database');
const Branch = require('../../models/Branch/Branch');
const { createBranchSchema } = require('../../models/Branch/Branch');
const { validateRequest } = require('../../utils/zodValidator');

exports.handler = async (event) => {
  try {
    // 1. Validate API Key
    const apiKey = event.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Invalid API key' })
      };
    }

    // 2. Validate Request Body with Zod
    const validation = validateRequest(event.body, createBranchSchema);
    if (!validation.success) {
      return validation.errorResponse;
    }

    // 3. Connect to Database
    await connectToDatabase();

    // 4. Use validated data
    const validatedData = validation.data;
    const branch = new Branch(validatedData);
    await branch.save();

    // 5. Return Success Response
    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Branch created successfully',
        data: branch
      })
    };
  } catch (error) {
    console.error('Error creating branch:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};
```

### Example 2: Updating a Branch (PUT Request)

```javascript
// handlers/Branch/updateBranch.js
const { validateRequest, validatePathParameters } = require('../../utils/zodValidator');
const { updateBranchSchema, branchIdSchema } = require('../../models/Branch/Branch');
const Branch = require('../../models/Branch/Branch');

exports.handler = async (event) => {
  try {
    // Validate API Key
    const apiKey = event.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid API key' })
      };
    }

    // Validate Path Parameters
    const pathValidation = validatePathParameters(
      event.pathParameters,
      branchIdSchema
    );
    if (!pathValidation.success) {
      return pathValidation.errorResponse;
    }

    // Validate Request Body
    const bodyValidation = validateRequest(event.body, updateBranchSchema);
    if (!bodyValidation.success) {
      return bodyValidation.errorResponse;
    }

    // Connect to Database
    await connectToDatabase();

    // Update Branch
    const { id } = pathValidation.data;
    const updateData = bodyValidation.data;

    const branch = await Branch.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    if (!branch) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Branch not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Branch updated successfully',
        data: branch
      })
    };
  } catch (error) {
    console.error('Error updating branch:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};
```

### Example 3: Creating a Customer

```javascript
// handlers/Customer/createCustomer.js
const { validateRequest } = require('../../utils/zodValidator');
const { createCustomerSchema } = require('../../models/Customer/customer');
const Customer = require('../../models/Customer/customer');

exports.handler = async (event) => {
  try {
    // API Key validation...

    // Validate Request
    const validation = validateRequest(event.body, createCustomerSchema);
    if (!validation.success) {
      return validation.errorResponse;
    }

    await connectToDatabase();

    // Create customer with validated data
    const customer = new Customer(validation.data);
    await customer.save();

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Customer created successfully',
        data: customer
      })
    };
  } catch (error) {
    // Handle duplicate key errors from MongoDB
    if (error.code === 11000) {
      return {
        statusCode: 409,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({
          message: 'Customer with this company name already exists in this branch'
        })
      };
    }

    console.error('Error creating customer:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};
```

### Example 4: Creating an Order (Complex Nested Schema)

```javascript
// handlers/order/createOrder.js
const { validateRequest } = require('../../utils/zodValidator');
const { createOrderSchema } = require('../../models/oders/oders');
const Order = require('../../models/oders/oders');

exports.handler = async (event) => {
  try {
    // API Key validation...

    // Validate complex order data
    const validation = validateRequest(event.body, createOrderSchema);
    if (!validation.success) {
      // Returns detailed validation errors for all nested fields
      return validation.errorResponse;
    }

    await connectToDatabase();

    // All nested data (mixMaterial, steps, mixingTracking) is validated
    const order = new Order(validation.data);
    await order.save();

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Order created successfully',
        data: order
      })
    };
  } catch (error) {
    console.error('Error creating order:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};
```

### Example 5: Partial Update (PATCH)

```javascript
// handlers/Branch/patchBranch.js
const { validatePartialRequest, validatePathParameters } = require('../../utils/zodValidator');
const { updateBranchSchema, branchIdSchema } = require('../../models/Branch/Branch');
const Branch = require('../../models/Branch/Branch');

exports.handler = async (event) => {
  try {
    // API Key validation...

    // Validate Path Parameters
    const pathValidation = validatePathParameters(
      event.pathParameters,
      branchIdSchema
    );
    if (!pathValidation.success) {
      return pathValidation.errorResponse;
    }

    // Validate Partial Update (all fields optional)
    const bodyValidation = validatePartialRequest(event.body, updateBranchSchema);
    if (!bodyValidation.success) {
      return bodyValidation.errorResponse;
    }

    await connectToDatabase();

    // Update only provided fields
    const { id } = pathValidation.data;
    const updateData = bodyValidation.data;

    const branch = await Branch.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!branch) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Branch not found' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Branch partially updated successfully',
        data: branch
      })
    };
  } catch (error) {
    console.error('Error updating branch:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};
```

## Error Response Format

When validation fails, Zod returns a structured error response:

```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "invalid_string"
    },
    {
      "field": "phone1",
      "message": "Phone number must be at least 10 digits",
      "code": "too_small"
    }
  ]
}
```

## Benefits of Zod Validation

1. **Type Safety**: Zod provides runtime type checking that matches your Mongoose schemas
2. **Better Error Messages**: Clear, field-specific validation errors
3. **Input Sanitization**: Zod transforms and sanitizes data (trim, lowercase, etc.)
4. **Nested Validation**: Validates complex nested objects (like Order with mixMaterial, steps)
5. **Prevents Invalid Data**: Catches errors before database operations
6. **Consistent Validation**: Same validation rules across all handlers
7. **Auto-completion**: When using TypeScript, Zod provides excellent IDE support

## Next Steps

To add validation to your existing handlers:

1. Import the validation utility:
   ```javascript
   const { validateRequest } = require('../../utils/zodValidator');
   ```

2. Import the appropriate schema:
   ```javascript
   const { createBranchSchema } = require('../../models/Branch/Branch');
   ```

3. Add validation before database operations:
   ```javascript
   const validation = validateRequest(event.body, createBranchSchema);
   if (!validation.success) {
     return validation.errorResponse;
   }
   const data = validation.data; // Use validated data
   ```

## Models With Zod Schemas

✅ **Branch** - Complete with create, update, and ID schemas
✅ **Customer** - Complete with create, update, and ID schemas
✅ **Product** - Complete with create, update, and ID schemas
✅ **Machine** - Complete with create, update, and ID schemas (includes nested table config)
✅ **Order** - Complete with create, update, and ID schemas (includes all nested schemas)

### Remaining Models (22)

The following models still need Zod schemas:
- Admin, Manager, MasterAdmin
- MachineType, MachineOperator
- Material, MaterialType, MaterialFormula
- ProductCatalogue, productSpec
- Product27InfinitySchema
- Table, Step
- devicesForControlPanel, deviceAccess, deviceAddmachine
- company, supportTicket
- Analytics (materialUsageAnalytics, productOrderAnalytics)
- calculatePlastic (formulaStorage, calculationEngine)

These can be added using the same pattern as the examples above.
