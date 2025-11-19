# 🚀 Setup and Deployment Guide

Complete guide to set up and deploy the mobile-optimized backend with caching and monitoring.

## 📋 Prerequisites

- Node.js 20.x or higher
- AWS Account with configured credentials
- MongoDB Atlas cluster
- Redis instance (optional but recommended)

---

## ⚙️ Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install New Dependencies (Redis)

```bash
npm install ioredis
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update `.env` with your credentials:

```env
# MongoDB
MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/dbname"

# JWT
JWT_SECRET="your-secure-jwt-secret-here"

# API Key
API_KEY="your-api-key-here"

# Redis (Optional - for caching)
REDIS_HOST="your-redis-host.com"
REDIS_PORT="6379"
REDIS_PASSWORD="your-redis-password"
REDIS_DB="0"

# Environment
NODE_ENV="production"
VERSION="1.0.0"
```

---

## 🔧 Redis Setup Options

### Option 1: AWS ElastiCache (Recommended for Production)

1. **Create ElastiCache Redis Cluster:**
   - Go to AWS ElastiCache Console
   - Create Redis cluster
   - Choose `cache.t3.micro` for testing (or larger for production)
   - Enable automatic failover
   - Note the endpoint URL

2. **Update Environment:**
   ```env
   REDIS_HOST="your-cluster.cache.amazonaws.com"
   REDIS_PORT="6379"
   ```

### Option 2: Redis Cloud (Easy Setup)

1. Sign up at [Redis Cloud](https://redis.com/try-free/)
2. Create free database
3. Get connection details
4. Update environment variables

### Option 3: Local Redis (Development)

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt-get install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

### Option 4: Skip Redis (Not Recommended)

If you don't want to use Redis, the system will work without caching. Simply leave Redis environment variables empty.

---

## 🏗️ Build and Test Locally

### 1. Build TypeScript (if using TS)

```bash
npm run build
```

### 2. Run Locally with Serverless Offline

```bash
npm run offline
```

or

```bash
serverless offline start
```

The API will be available at `http://localhost:4000`

### 3. Test Endpoints

```bash
# Health check
curl http://localhost:4000/health

# Detailed health
curl http://localhost:4000/health/detailed

# Operator login (example)
curl -X POST http://localhost:4000/mobile/operator/login \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"pin":"1234","branchId":"507f1f77bcf86cd799439011"}'
```

---

## 🚀 Deploy to AWS

### 1. Configure AWS Credentials

```bash
aws configure
```

Enter your:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `ap-south-1`)

### 2. Update `serverless.yml` Environment

Add Redis credentials to `serverless.yml`:

```yaml
provider:
  environment:
    MONGO_URI: ${env:MONGO_URI}
    API_KEY: ${env:API_KEY}
    JWT_SECRET: ${env:JWT_SECRET}
    NODE_ENV: production
    REDIS_HOST: ${env:REDIS_HOST}
    REDIS_PORT: ${env:REDIS_PORT}
    REDIS_PASSWORD: ${env:REDIS_PASSWORD}
    REDIS_DB: ${env:REDIS_DB}
```

### 3. Deploy

```bash
serverless deploy --stage dev
```

or for production:

```bash
serverless deploy --stage prod
```

### 4. Note the Endpoints

After deployment, you'll see output like:

```
endpoints:
  POST - https://abc123.execute-api.ap-south-1.amazonaws.com/dev/mobile/operator/login
  GET - https://abc123.execute-api.ap-south-1.amazonaws.com/dev/mobile/operator/orders/pending
  GET - https://abc123.execute-api.ap-south-1.amazonaws.com/dev/health
  ...
```

Save this base URL for your mobile app configuration.

---

## 📱 Mobile App Integration

### 1. Configure API Base URL

In your mobile app, set the base URL:

```javascript
// config.js
export const API_BASE_URL =
  __DEV__
    ? 'http://localhost:4000'
    : 'https://abc123.execute-api.ap-south-1.amazonaws.com/dev';

export const API_KEY = 'your-api-key-here';
```

### 2. Create API Client

```javascript
// api/client.js
import { API_BASE_URL, API_KEY } from '../config';

export const apiClient = {
  async post(endpoint, data) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  },

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  },
};
```

### 3. Example: Operator Login

```javascript
// screens/OperatorLoginScreen.js
import { apiClient } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const handleLogin = async (pin, branchId) => {
  try {
    setLoading(true);
    const data = await apiClient.post('/mobile/operator/login', {
      pin,
      branchId,
    });

    // Store session
    await AsyncStorage.setItem('operatorToken', data.sessionToken);
    await AsyncStorage.setItem('operatorData', JSON.stringify(data.operator));

    // Navigate to home
    navigation.navigate('OperatorHome');
  } catch (error) {
    Alert.alert('Login Failed', error.message);
  } finally {
    setLoading(false);
  }
};
```

---

## 📊 Monitoring Setup

### 1. CloudWatch Logs

All logs are automatically sent to CloudWatch Logs. Access them at:

```
AWS Console → CloudWatch → Log Groups → /aws/lambda/this27-dev-*
```

### 2. View Metrics

Access metrics endpoint:

```bash
curl https://your-api.amazonaws.com/dev/monitoring/metrics \
  -H "x-api-key: your-api-key"
```

### 3. View Errors

```bash
curl https://your-api.amazonaws.com/dev/monitoring/errors?days=7 \
  -H "x-api-key: your-api-key"
```

### 4. Health Check

```bash
curl https://your-api.amazonaws.com/dev/health/detailed
```

---

## 🔍 Testing the System

### 1. Test Health Check

```bash
curl https://your-api.amazonaws.com/dev/health
```

Expected: `{"status":"healthy",...}`

### 2. Test Operator Login

```bash
curl -X POST https://your-api.amazonaws.com/dev/mobile/operator/login \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "pin": "1234",
    "branchId": "your-branch-id"
  }'
```

### 3. Test Manager Dashboard

```bash
curl https://your-api.amazonaws.com/dev/mobile/manager/dashboard \
  -H "x-api-key: your-api-key" \
  -H "Authorization: Bearer your-manager-jwt-token"
```

### 4. Test Caching

```bash
# First request (cache MISS)
curl -i https://your-api.amazonaws.com/dev/mobile/manager/dashboard \
  -H "x-api-key: your-api-key" \
  -H "Authorization: Bearer token"

# Second request (cache HIT)
curl -i https://your-api.amazonaws.com/dev/mobile/manager/dashboard \
  -H "x-api-key: your-api-key" \
  -H "Authorization: Bearer token"

# Check for "X-Cache: HIT" header
```

---

## 🐛 Troubleshooting

### Issue: Redis Connection Failed

**Solution:**
1. Check Redis host and port
2. Verify security group allows Lambda access
3. Ensure Redis is in same VPC as Lambda (if using ElastiCache)
4. Check Redis password is correct

### Issue: MongoDB Connection Timeout

**Solution:**
1. Verify MongoDB URI is correct
2. Check MongoDB Atlas IP whitelist (allow `0.0.0.0/0` for Lambda)
3. Ensure connection string includes credentials

### Issue: API Key Invalid

**Solution:**
1. Verify `x-api-key` header is being sent
2. Check API_KEY in environment variables
3. Redeploy after changing environment variables

### Issue: High Latency

**Solution:**
1. Enable Redis caching
2. Check Lambda memory allocation (increase if needed)
3. Review CloudWatch logs for slow queries
4. Add database indexes

### Issue: Lambda Timeout

**Solution:**
1. Increase timeout in `serverless.yml`:
   ```yaml
   functions:
     yourFunction:
       timeout: 30  # seconds
   ```
2. Optimize database queries
3. Enable caching

---

## 📈 Performance Optimization

### 1. Enable Redis Caching

Caching reduces database queries by 60-80%. Make sure Redis is configured.

### 2. Optimize Lambda Memory

Test different memory allocations:

```yaml
functions:
  getManagerDashboard:
    memorySize: 512  # Start here
    # Monitor CloudWatch and adjust
```

Higher memory = faster CPU = potentially lower cost.

### 3. Database Indexing

Add indexes to frequently queried fields:

```javascript
// In your models
operatorSchema.index({ pin: 1, branchId: 1 });
orderSchema.index({ branchId: 1, status: 1 });
machineSchema.index({ branchId: 1, status: 1 });
```

### 4. Enable Connection Pooling

Already enabled in MongoDB connection. Verify:

```javascript
// config/mongodb/db.js
const options = {
  maxPoolSize: 10,
  minPoolSize: 2,
};
```

---

## 🔐 Security Checklist

- [ ] Change default API_KEY
- [ ] Use strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS only (no HTTP)
- [ ] Implement rate limiting
- [ ] Add IP whitelisting for admin endpoints
- [ ] Enable CloudWatch alarms for errors
- [ ] Regular security audits
- [ ] Keep dependencies updated

---

## 📝 Next Steps

1. **Set up CI/CD Pipeline**
   - GitHub Actions or GitLab CI
   - Auto-deploy on merge to main

2. **Add More Tests**
   - Unit tests with Jest
   - Integration tests
   - Load testing with k6

3. **Implement WebSockets**
   - Real-time order updates
   - Live machine status
   - Push notifications

4. **Add API Documentation**
   - Auto-generate with Swagger
   - Host on API Gateway

5. **Set up Monitoring Dashboard**
   - Grafana for metrics
   - Sentry for error tracking
   - PagerDuty for alerts

---

## 📚 Additional Resources

- [Serverless Framework Docs](https://www.serverless.com/framework/docs)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)

---

## 🆘 Support

For issues or questions:
1. Check logs in CloudWatch
2. Review this documentation
3. Check API documentation in `MOBILE_API_DOCUMENTATION.md`
4. Contact your DevOps team

---

**Last Updated:** November 2025
**Version:** 1.0.0
