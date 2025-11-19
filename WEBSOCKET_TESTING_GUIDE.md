# WebSocket Testing Guide
## Complete Testing Procedures for 27 Manufacturing System

---

## 📋 Pre-Testing Checklist

- [ ] Deployment completed successfully
- [ ] WebSocket URL obtained from deployment output
- [ ] JWT token obtained from login endpoint
- [ ] wscat installed (`npm install -g wscat`)

---

## 🧪 Test Suite

### Test 1: Basic Connection ✅

**Objective**: Verify WebSocket connection works

**Steps**:
```bash
# Get JWT token first
curl -X POST https://YOUR_API/dev/manager/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@example.com","password":"yourpassword"}'

# Extract token from response: TOKEN="eyJhbGciOiJIUzI1..."

# Connect to WebSocket
wscat -c "wss://YOUR_WEBSOCKET_URL/dev?token=YOUR_JWT_TOKEN"
```

**Expected Result**:
```
Connected (press CTRL+C to quit)
< {"message":"Connected","connectionId":"abc123","rooms":["branch:xyz","user:123","role:manager:xyz"]}
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 2: Ping/Pong (Heartbeat) ✅

**Objective**: Verify message handling works

**Steps**:
```bash
# After connecting, send:
> {"action":"ping"}
```

**Expected Result**:
```json
{
  "action": "pong",
  "timestamp": "2025-01-17T..."
}
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 3: Get Connection Status ✅

**Objective**: Verify connection info retrieval

**Steps**:
```bash
> {"action":"getStatus"}
```

**Expected Result**:
```json
{
  "action": "getStatus",
  "connectionId": "abc123",
  "role": "manager",
  "branchId": "xyz789",
  "rooms": ["branch:xyz789", "user:123", "role:manager:xyz789"],
  "connectedAt": "2025-01-17T...",
  "platform": "web",
  "status": "active"
}
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 4: Get Subscribed Rooms ✅

**Objective**: Verify room subscription listing

**Steps**:
```bash
> {"action":"getRooms"}
```

**Expected Result**:
```json
{
  "action": "getRooms",
  "rooms": ["branch:xyz789", "user:123", "role:manager:xyz789"],
  "count": 3
}
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 5: Subscribe to Order Room ✅

**Objective**: Verify order-specific subscriptions

**Steps**:
```bash
# Replace ORDER_ID with actual order ID from your database
> {"action":"subscribeToOrder","data":{"orderId":"ORDER_ID"}}
```

**Expected Result** (if order belongs to your branch):
```json
{
  "action": "subscribeToOrder",
  "success": true,
  "orderId": "ORDER_ID"
}
```

**Expected Result** (if order doesn't belong to your branch):
```json
{
  "error": "Unauthorized",
  "message": "You do not have permission to access this order",
  "action": "subscribeToOrder"
}
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 6: Subscribe to Machine Room ✅

**Objective**: Verify machine-specific subscriptions

**Steps**:
```bash
> {"action":"subscribeToMachine","data":{"machineId":"MACHINE_ID"}}
```

**Expected Result** (if authorized):
```json
{
  "action": "subscribeToMachine",
  "success": true,
  "machineId": "MACHINE_ID"
}
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 7: Cross-Tenant Isolation 🔒

**Objective**: Verify users cannot access other branches

**Steps**:
```bash
# Try to subscribe to a different branch's order
> {"action":"subscribeToOrder","data":{"orderId":"OTHER_BRANCH_ORDER_ID"}}
```

**Expected Result**:
```json
{
  "error": "Unauthorized",
  "message": "You do not have permission to access this order",
  "action": "subscribeToOrder"
}
```

**Status**: ✅ PASS (blocked) / ❌ FAIL (allowed access)

---

### Test 8: Rate Limiting 🔒

**Objective**: Verify rate limiting (100 messages/minute)

**Steps**:
```bash
# Send 101 messages rapidly
for i in {1..101}; do
  echo '{"action":"ping"}'
done
```

**Expected Result**:
- First 100 messages: `{"action":"pong",...}`
- 101st message:
```json
{
  "error": "Rate limit exceeded",
  "message": "Maximum 100 messages per minute",
  "retryAfter": 45
}
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 9: Connection Limit 🔒

**Objective**: Verify connection limits (10 per user)

**Steps**:
```bash
# Open 11 WebSocket connections with same token
# (Use multiple terminal windows or a script)

# Connection 1-10: Should succeed
# Connection 11: Should be rejected
```

**Expected Result** (11th connection):
```json
{
  "message": "Connection limit exceeded",
  "maxConnections": 10
}
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 10: Invalid Token 🔒

**Objective**: Verify authentication requirement

**Steps**:
```bash
# Connect without token
wscat -c "wss://YOUR_WEBSOCKET_URL/dev"

# OR with invalid token
wscat -c "wss://YOUR_WEBSOCKET_URL/dev?token=invalid_token"
```

**Expected Result**:
```
Connection rejected with status 401
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 11: Message Size Limit 🔒

**Objective**: Verify message size validation (128 KB max)

**Steps**:
```bash
# Send a large message (>128 KB)
> {"action":"ping","data":"AAAA..." } # Very long string
```

**Expected Result**:
```json
{
  "message": "Message too large"
}
```

**Status**: ✅ PASS / ❌ FAIL

---

### Test 12: Single Session Enforcement 🔒

**Objective**: Verify auto-logout on new login

**Steps**:
1. Open WebSocket connection on Device A
2. Login from Device B (via REST API)
3. Check Device A WebSocket

**Expected Result** (Device A receives):
```json
{
  "type": "session:force_logout",
  "data": {
    "reason": "new_login",
    "message": "You have been logged out because a new session was started on another device",
    "timestamp": "2025-01-17T..."
  }
}
```

**Status**: ✅ PASS / ❌ FAIL

---

## 🎯 Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Basic Connection | ⏳ Pending | |
| 2. Ping/Pong | ⏳ Pending | |
| 3. Get Status | ⏳ Pending | |
| 4. Get Rooms | ⏳ Pending | |
| 5. Subscribe to Order | ⏳ Pending | |
| 6. Subscribe to Machine | ⏳ Pending | |
| 7. Cross-Tenant Isolation | ⏳ Pending | |
| 8. Rate Limiting | ⏳ Pending | |
| 9. Connection Limit | ⏳ Pending | |
| 10. Invalid Token | ⏳ Pending | |
| 11. Message Size Limit | ⏳ Pending | |
| 12. Single Session | ⏳ Pending | |

---

## 📊 Performance Tests

### Test 13: Connection Speed

**Objective**: Measure connection establishment time

**Expected**: < 500ms

---

### Test 14: Message Latency

**Objective**: Measure ping-pong roundtrip time

**Expected**: < 100ms

---

### Test 15: Concurrent Connections

**Objective**: Test with 100 simultaneous connections

**Expected**: All connections stable, no errors

---

## 🐛 Troubleshooting

### Connection Fails

**Check**:
1. JWT token is valid (not expired)
2. WebSocket URL is correct (starts with `wss://`)
3. Token includes `userId`, `role`, `branchId`

---

### "Unauthorized" Error

**Check**:
1. User exists in database
2. User is active (`isActive: true`)
3. User has branchId assigned

---

### "Rate Limit Exceeded"

**Solution**: Wait 60 seconds and try again

---

### "Connection Limit Exceeded"

**Solution**: Close existing connections or wait for TTL cleanup (2 hours)

---

## 📝 Test Automation Script

```bash
#!/bin/bash

# WebSocket Testing Script

# Configuration
WEBSOCKET_URL="wss://YOUR_WEBSOCKET_URL/dev"
LOGIN_URL="https://YOUR_REST_API/dev/manager/login"

# Get JWT token
echo "🔐 Getting JWT token..."
TOKEN=$(curl -s -X POST $LOGIN_URL \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@example.com","password":"yourpassword"}' \
  | jq -r '.token')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."

# Test 1: Connect
echo ""
echo "🧪 Test 1: Basic Connection"
echo '{"action":"ping"}' | wscat -c "$WEBSOCKET_URL?token=$TOKEN"

# Add more automated tests here...
```

---

## ✅ Deployment Verification Checklist

After deployment completes:

- [ ] REST API endpoints still work
- [ ] WebSocket URL obtained
- [ ] All 12 tests pass
- [ ] No CloudWatch errors
- [ ] Connection pooling working
- [ ] MongoDB connections < 50

---

**Testing Date**: _____________
**Tested By**: _____________
**All Tests Passed**: ✅ YES / ❌ NO
