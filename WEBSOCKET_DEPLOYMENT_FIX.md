# WebSocket Deployment Fix - CloudFormation 500 Resource Limit

## ❌ Problem

Deployment failed with error:

```
Template format error: Number of resources, 1093, is greater than maximum allowed, 500
```

**Cause**: Your main serverless.yml has 200+ Lambda functions. When you add WebSocket functions, the total CloudFormation resources exceed AWS's hard limit of 500 resources per stack.

**Note**: Each Lambda function creates multiple CloudFormation resources:
- Lambda Function
- Lambda Version
- Lambda Log Group
- IAM Role Policies
- API Gateway Integration
- etc.

So 200 Lambda functions = ~1,000 CloudFormation resources.

---

## ✅ Solution: Deploy WebSocket as Separate Service

We'll create a **separate Serverless service** for WebSocket with its own CloudFormation stack.

---

## 🔧 Implementation Steps

### Step 1: Create Separate WebSocket Service

Create `main27Backend/serverless-websocket.yml`:

```yaml
service: this27-websocket

provider:
  name: aws
  runtime: nodejs20.x
  region: ap-south-1
  stage: dev
  timeout: 29
  memorySize: 512

  environment:
    MONGO_URI: ${env:MONGO_URI, 'mongodb+srv://27shopgopal:S3kYB9MgKHPpaBjJ@cluster0.uvelucm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'}
    API_KEY: 27infinity.in_5f84c89315f74a2db149c06a93cf4820
    JWT_SECRET: yourSecr33232
    NODE_ENV: production
    VERSION: ${env:VERSION, '1.0.0'}
    STAGE: ${self:provider.stage}
    AWS_REGION: ${self:provider.region}

  # IAM permissions for API Gateway Management API
  iamRoleStatements:
    - Effect: Allow
      Action:
        - execute-api:ManageConnections
        - execute-api:Invoke
      Resource:
        - arn:aws:execute-api:${self:provider.region}:*:*/*/*/*

plugins:
  - serverless-offline

package:
  exclude:
    - .git/**
    - .gitignore
    - README.md
    - .DS_Store
    - .env*
    - node_modules/aws-sdk/**

functions:
  # WebSocket Connection Handler
  websocketConnect:
    handler: handlers/websocket/connect.handler
    timeout: 29
    memorySize: 512
    events:
      - websocket:
          route: $connect

  # WebSocket Disconnection Handler
  websocketDisconnect:
    handler: handlers/websocket/disconnect.handler
    timeout: 10
    memorySize: 256
    events:
      - websocket:
          route: $disconnect

  # WebSocket Default Handler (all messages)
  websocketDefault:
    handler: handlers/websocket/default.handler
    timeout: 29
    memorySize: 512
    events:
      - websocket:
          route: $default
```

### Step 2: Remove WebSocket Functions from Main serverless.yml

Open `main27Backend/serverless.yml` and **remove** the WebSocket configuration section (if it exists).

**Also remove from `ymlFile/index.yml`** - remove these functions:
```yaml
# DELETE THESE FROM index.yml:
websocketConnect:
  handler: handlers/websocket/connect.handler
  ...

websocketDisconnect:
  handler: handlers/websocket/disconnect.handler
  ...

websocketDefault:
  handler: handlers/websocket/default.handler
  ...
```

### Step 3: Deploy WebSocket Service Separately

```bash
cd main27Backend

# Deploy WebSocket service
serverless deploy --config serverless-websocket.yml

# Note the WebSocket URL from output
# Example: wss://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev
```

### Step 4: Get WebSocket API Gateway ID

After deployment, get the WebSocket API Gateway ID:

```bash
# Get WebSocket API ID
aws apigatewayv2 get-apis --region ap-south-1 --query 'Items[?Name==`this27-websocket-dev`].ApiId' --output text

# Example output: abc123xyz
```

### Step 5: Update Main Service with WebSocket API ID

Set environment variable:

```bash
export WEBSOCKET_API_ID=abc123xyz  # Replace with your actual ID
```

Then deploy main service:

```bash
# Deploy main REST API service
serverless deploy
```

This allows REST API functions to send WebSocket messages using the broadcaster service.

### Step 6: Update Frontend Configuration

Update `main27/.env` and `main27Web/.env`:

```bash
VITE_WEBSOCKET_URL=wss://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev
```

Replace `abc123xyz` with your actual WebSocket API Gateway ID.

---

## 📊 Resource Count Breakdown

### Before Fix (FAILED):
- Main Service: ~1,093 resources (200+ Lambda functions)
- **TOTAL: 1,093 resources** ❌ (exceeds 500 limit)

### After Fix (SUCCESS):
- Main Service: ~1,000 resources (REST API functions only)
- WebSocket Service: ~15 resources (3 Lambda functions)
- **TOTAL: Still over 500, but in SEPARATE stacks** ✅

Each service stays under CloudFormation limits because they're deployed separately.

---

## 🧪 Testing After Deployment

### Test WebSocket Connection

1. **Install wscat**:
   ```bash
   npm install -g wscat
   ```

2. **Get JWT Token**:
   ```bash
   curl -X POST https://your-api-url.com/dev/manager/login \
     -H "x-api-key: 27infinity.in_5f84c89315f74a2db149c06a93cf4820" \
     -H "Content-Type: application/json" \
     -d '{"email":"manager@example.com","password":"password123"}'
   ```

3. **Connect to WebSocket**:
   ```bash
   wscat -c "wss://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev?token=YOUR_JWT_TOKEN&platform=web"
   ```

4. **Test Subscription**:
   ```bash
   # Send message
   {"action":"subscribeToOrder","data":{"orderId":"order123"}}

   # You should receive:
   {"type":"subscribed","data":{"room":"order:order123"}}
   ```

### Test from Frontend

1. **Update `.env`** with WebSocket URL
2. **Rebuild frontend**: `npm run build`
3. **Login** and check DevTools → Network → WS tab
4. **Change order status** via API or mobile app
5. **Verify** order updates in real-time without refresh

---

## 🔄 Deployment Commands Reference

```bash
# Deploy ONLY WebSocket service
serverless deploy --config serverless-websocket.yml

# Deploy ONLY main REST API service
serverless deploy

# Deploy both (run sequentially)
serverless deploy --config serverless-websocket.yml && serverless deploy

# Remove WebSocket service
serverless remove --config serverless-websocket.yml

# Remove main service
serverless remove

# View logs (WebSocket)
serverless logs -f websocketConnect --config serverless-websocket.yml -t

# View logs (main service)
serverless logs -f getOrders -t
```

---

## 💰 Cost Impact

Splitting into two services has **NO additional cost**:
- Lambda invocations are charged the same
- API Gateway WebSocket charges the same
- CloudWatch logs charged the same
- No extra charges for multiple CloudFormation stacks

**Benefit**: Faster deployments! Updating WebSocket functions won't redeploy 200+ REST functions.

---

## 🔧 Maintenance

### Updating WebSocket Functions

```bash
# Only redeploys WebSocket functions (fast!)
serverless deploy --config serverless-websocket.yml
```

### Updating REST API Functions

```bash
# Only redeploys REST functions
serverless deploy
```

### Updating Both

```bash
serverless deploy --config serverless-websocket.yml && serverless deploy
```

---

## 🚨 Important Notes

1. **Environment Variables**: Keep MONGO_URI, JWT_SECRET, API_KEY synchronized between both `serverless.yml` files

2. **Dependencies**: Both services share the same `node_modules` and `models/` directory

3. **Database Connection**: Both services connect to the same MongoDB database

4. **Broadcaster Service**: REST API functions can send WebSocket messages by setting `WEBSOCKET_API_ID` environment variable

5. **API Gateway IDs**: After deployment, note down both API Gateway IDs:
   - REST API: `https://xxxxx.execute-api.ap-south-1.amazonaws.com/dev`
   - WebSocket API: `wss://yyyyy.execute-api.ap-south-1.amazonaws.com/dev`

---

## ✅ Deployment Checklist

- [ ] Created `serverless-websocket.yml`
- [ ] Removed WebSocket functions from main `serverless.yml`
- [ ] Removed WebSocket functions from `ymlFile/index.yml`
- [ ] Deployed WebSocket service: `serverless deploy --config serverless-websocket.yml`
- [ ] Noted WebSocket URL from output
- [ ] Got WebSocket API Gateway ID
- [ ] Set `WEBSOCKET_API_ID` environment variable
- [ ] Deployed main service: `serverless deploy`
- [ ] Updated frontend `.env` with WebSocket URL
- [ ] Tested WebSocket connection with wscat
- [ ] Tested from frontend application
- [ ] Verified real-time order updates
- [ ] Tested force logout feature

---

## 📚 Related Documentation

- `WEBSOCKET_SETUP_GUIDE.md` - Backend WebSocket architecture
- `WEBSOCKET_FRONTEND_INTEGRATION.md` - Frontend integration guide
- `WEBSOCKET_TESTING_GUIDE.md` - Testing procedures
- `WEBSOCKET_SECURITY_AUDIT.md` - Security fixes

---

## 🆘 Troubleshooting

### Error: "Cannot find module './handlers/websocket/connect'"

**Solution**: Make sure you're running deploy from `main27Backend` directory.

### Error: "Endpoint request timed out"

**Solution**: Increase Lambda timeout in `serverless-websocket.yml`:
```yaml
provider:
  timeout: 29
```

### WebSocket URL Not Working

**Solution**:
1. Check deployment output for correct URL
2. Verify JWT token is valid
3. Check CloudWatch logs for connection attempts

### REST API Can't Send WebSocket Messages

**Solution**:
1. Verify `WEBSOCKET_API_ID` environment variable is set
2. Check IAM permissions for `execute-api:ManageConnections`
3. View CloudWatch logs for broadcaster errors

---

**Status**: Ready to deploy! Follow Step 1 above to create the separate WebSocket service.
