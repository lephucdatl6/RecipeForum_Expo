# Performance Testing Guide

## Prerequisites
1. Backend server running
2. PostgreSQL and MongoDB databases accessible
3. `.env` file configured

## Running Performance Test

### Step 1: Start Backend Server
```bash
npm run backend
```

### Step 2: Start Ngrok
```bash
cd backend
npx ngrok http 3001
```

### Step 3: Run Performance Test
```bash
cd backend
node performance-check.js
```

**What it tests:**
- Database queries (PostgreSQL & MongoDB)
- Cross-database operations
- Memory usage
- AI service performance

**Duration:** ~30-60 seconds

---

## Expected Results

### Performance Benchmarks

**Excellent**: <50ms (PostgreSQL simple queries)
**Good**: 50-100ms (PostgreSQL complex, MongoDB lookups)
**Acceptable**: 100-500ms (MongoDB feeds, cross-database)
**Slow**: >500ms (needs optimization)

**AI Services:**
- Validation: 3-5 seconds (normal)
- Nutrition: 5-10 seconds (normal), 30+ seconds (rate limited or cold start)
- **Note:** Nutritional analysis may sometimes fail due to connection issues, API rate limits, or service unavailability

**Memory:**
- Heap: <100MB
- RSS: <200MB

---

## Troubleshooting

**Backend won't start:**
- Check `.env` file exists
- Verify database connections
- Check port 3001 is available

**Test fails:**
- Ensure backend is running (`npm run backend`)
- Ensure ngrok is running
- Check databases are accessible

**AI tests fail:**
- Check internet connection
- Verify `GOOGLE_API_KEY` in `.env`
- AI service may be temporarily unavailable (retry later)
