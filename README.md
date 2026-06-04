# X7 Liquidation Engine

Real-time Aave V3 liquidation monitoring across Ethereum, Polygon, and Arbitrum.

## Features

✅ **Multi-Network Monitoring**
- Ethereum, Polygon, Arbitrum (all live)
- Real Aave V3 subgraph queries
- Health factor verification

✅ **Opportunity Identification**
- Scans for underwater positions
- Calculates net profit (with gas deduction)
- Filters by profitability threshold

✅ **Dashboard**
- Real-time stats per network
- Combined metrics
- Liquidation feed with details

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/agrocompany111-debug/X7
cd X7
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

Get Alchemy API keys:
- Go to https://www.alchemy.com/
- Create app for each network (Ethereum, Polygon, Arbitrum)
- Paste into `.env`

### 3. Run Locally
```bash
npm start
```

Visit: http://localhost:3000

## Railway Deployment

1. Push to GitHub (already done)
2. Go to https://railway.app
3. Click **New Project** → **Deploy from GitHub**
4. Select `agrocompany111-debug/X7`
5. Add environment variables:
   - `ALCHEMY_ETH_API_KEY`
   - `ALCHEMY_POLYGON_API_KEY`
   - `ALCHEMY_ARBITRUM_API_KEY`
6. Click **Deploy**
7. After 2 min, click **Generate Domain**

Your dashboard URL: `https://x7-xxxxx.railway.app`

## API Endpoints

```
GET  /api/health              → System status
GET  /api/stats               → Combined & per-network stats
GET  /api/liquidations        → Identified opportunities
POST /api/withdraw            → Record withdrawal
GET  /api/withdrawals         → Withdrawal history
```

## Architecture

```
api/server.js          → Express API
services/liquidator.js → Aave V3 scanner (per network)
services/treasury.js   → Withdrawal tracking
config/networks.js     → Network config & RPC endpoints
client/index.html      → Dashboard UI
```

## Monitoring

Dashboard updates every 10 seconds with:
- Total profit identified
- Liquidations found per network
- Estimated gas costs
- Treasury balance

## Notes

- Currently **identifies** profitable liquidations
- Ready for integration with transaction execution
- Profit threshold configurable per network
- No private keys required (monitoring only)

## License

MIT
