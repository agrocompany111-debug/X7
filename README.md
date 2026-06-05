# X7 Liquidation Engine

Real-time Aave V3 liquidation execution across Ethereum, Polygon, and Arbitrum.

## Features

✅ **Multi-Network Liquidation**
- Ethereum, Polygon, Arbitrum (all live)
- Real Aave V3 subgraph queries
- Health factor verification

✅ **Automatic Liquidation Execution**
- Scans for underwater positions
- Calculates net profit (with gas deduction)
- Auto-executes profitable liquidations
- Token approval + liquidationCall flow
- Real transaction submission & tracking

✅ **Dashboard**
- Real-time stats per network
- Combined metrics
- Liquidation execution feed with tx hashes
- Executed transactions with scanner links

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

**Required Variables:**
- `ALCHEMY_ETH_API_KEY` - Get from https://www.alchemy.com/ (Ethereum Mainnet app)
- `ALCHEMY_POLYGON_API_KEY` - Get from https://www.alchemy.com/ (Polygon Mainnet app)
- `ALCHEMY_ARBITRUM_API_KEY` - Get from https://www.alchemy.com/ (Arbitrum Mainnet app)
- `PRIVATE_KEY` - Your wallet's private key (hex, starts with 0x) **⚠️ KEEP SECURE**
- `PORT` - Default 3000

### 3. Fund Your Wallet

Your liquidator needs ETH/tokens to:
1. Pay gas for approvals
2. Pay gas for liquidations
3. Have debt tokens to cover liquidations

Recommended starting: 1-2 ETH on Ethereum (for testing)

### 4. Run Locally (Monitoring Mode - No Execution)
```bash
# Without PRIVATE_KEY set - monitoring only
npm start
```

Visit: http://localhost:3000

### 5. Run with Execution Enabled
```bash
# With PRIVATE_KEY set - FULL EXECUTION
PRIVATE_KEY=0x... npm start
```

⚠️ **WARNING:** With PRIVATE_KEY set, the bot will execute real transactions and spend real money!

## Railway Deployment

### 1. Update Secret Environment Variables

⚠️ **CRITICAL:** Never commit `.env` file. Use Railway secrets instead.

```bash
git add -A && git commit -m "Update config"
git push origin main
```

### 2. Deploy on Railway

1. Go to https://railway.app
2. Click **New Project** → **Deploy from GitHub**
3. Select `agrocompany111-debug/X7`
4. Railway detects Dockerfile automatically
5. Click **Add Variables** and set:
   - `ALCHEMY_ETH_API_KEY=xxxxxxxxx`
   - `ALCHEMY_POLYGON_API_KEY=xxxxxxxxx`
   - `ALCHEMY_ARBITRUM_API_KEY=xxxxxxxxx`
   - `PRIVATE_KEY=0xxxxxxxxxxx` ⚠️ KEEP SECRET
   - `PORT=3000`
6. Click **Deploy**
7. Wait 2-3 minutes for build
8. Click **Generate Domain**

Your live dashboard: `https://x7-xxxxx.railway.app`

**Railway will restart automatically if it crashes.**

## API Endpoints

```
GET  /api/health              → System status
GET  /api/stats               → Combined & per-network stats
GET  /api/liquidations        → Executed liquidations
POST /api/withdraw            → Record withdrawal
GET  /api/withdrawals         → Withdrawal history
```

## Execution Flow

1. **Scan** (30s interval)
   - Query Aave subgraph for users with borrowedReservesCount > 0
   - Check health factor via contract call
   - Filter for HF < 1.0 (underwater)

2. **Calculate Profit**
   - Get current gas price
   - Calculate debt to cover (50% of debt)
   - Calculate liquidation bonus received
   - Deduct gas cost + 50 USD slippage
   - Compare to min profit threshold

3. **Execute** (if profitable & wallet exists)
   - Approve debt token to Aave Pool
   - Call liquidationCall() with borrower details
   - Wait for receipt
   - Update stats

4. **Track**
   - Store execution with tx hash
   - Link to scanner (Etherscan/Polygonscan/Arbiscan)
   - Update dashboard

## Dashboard Metrics

- **Total Net Profit** - Sum across all networks
- **Liquidations Executed** - Total successful executions
- **Gas Spent** - Total gas cost USD
- **Per-Network Breakdown** - Ethereum, Polygon, Arbitrum stats
- **Live Feed** - Recent executions with scanner links

## Architecture

```
api/server.js          → Express API + dashboard
services/liquidator.js → Aave V3 execution engine
services/treasury.js   → Withdrawal tracking
config/networks.js     → Network config & RPC endpoints
client/index.html      → Dashboard UI
```

## Security Notes

⚠️ **Private Key Management:**
- Never commit `.env` to git
- Use Railway/environment secrets only
- Rotate private key if compromised
- Consider using hardware wallet for production
- Start with testnet to verify flow

⚠️ **Fund Wallet Safely:**
- Only deposit what you're willing to lose
- Start small to test execution
- Monitor gas prices before large operations
- Set profit thresholds appropriately

⚠️ **Slippage & Risks:**
- Liquidations may fail due to price movements
- Failed transactions still cost gas
- MEV/sandwich attacks possible on mempool
- Always have buffer in wallet for gas

## Testing

### Local Testnet Flow
```bash
# 1. Deploy on testnet first
PRIVATE_KEY=0x... npm start
# 2. Fund wallet with test ETH
# 3. Monitor logs for errors
# 4. Verify executions on scanner
# 5. If successful, deploy to mainnet
```

### Monitoring Mode (No Execution)
```bash
# Run without PRIVATE_KEY to monitor only
npm start
# Check /api/stats to see opportunities
# No transactions will be sent
```

## Troubleshooting

**Issue:** "No PRIVATE_KEY - monitoring only"
- Solution: Set PRIVATE_KEY env var to enable execution

**Issue:** "Approval failed" or "Transaction reverted"
- Solution: Ensure wallet has ETH for gas + debt tokens for liquidation

**Issue:** "No subgraph data"
- Solution: Check Alchemy API keys, verify network RPC is responding

**Issue:** "Health factor check failed"
- Solution: Position may have been liquidated already, try scanning again

## Profit Calculation Example

```
Position: Borrower has 10 ETH debt, 8 ETH collateral (HF < 1)
Debt to cover: 5 ETH (50%)
Liquidation bonus: 5% → 5.25 ETH collateral received
Gas cost: 0.05 ETH (at 50 gwei, ~$100)
Net profit: (5.25 - 0.05 - 0.05 slippage) * 2000 = ~$10,300 USD
Min threshold: $100 USD → Profitable! Execute.
```

## License

MIT

## Disclaimer

This software executes real transactions on Aave Protocol mainnet. Use at your own risk.
The authors are not responsible for:
- Lost funds due to smart contract bugs
- Failed liquidations
- Gas costs
- Market losses
- User error

Always test on testnet first.
