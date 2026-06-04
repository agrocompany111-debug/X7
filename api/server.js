require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const networks = require('../config/networks');
const Liquidator = require('../services/liquidator');
const TreasuryManager = require('../services/treasury');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Init liquidators for all 3 networks
const liquidators = {
  ethereum: new Liquidator('ethereum', networks.ethereum),
  polygon: new Liquidator('polygon', networks.polygon),
  arbitrum: new Liquidator('arbitrum', networks.arbitrum)
};

const treasury = new TreasuryManager();

// Start all 3 networks
Object.values(liquidators).forEach(l => l.run());

// ── ROUTES ──────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    networks: ['ethereum', 'polygon', 'arbitrum']
  });
});

app.get('/api/stats', (req, res) => {
  const eth = liquidators.ethereum.getStats();
  const pol = liquidators.polygon.getStats();
  const arb = liquidators.arbitrum.getStats();

  const totalProfit = eth.totalProfit + pol.totalProfit + arb.totalProfit;
  const totalExecutions = eth.successful + pol.successful + arb.successful;

  res.json({
    combined: {
      totalProfitUSD: totalProfit.toFixed(2),
      totalExecutions,
      totalGasSpent: (eth.totalGas + pol.totalGas + arb.totalGas).toFixed(2),
      treasuryBalance: treasury.getBalance().toFixed(2)
    },
    networks: { ethereum: eth, polygon: pol, arbitrum: arb }
  });
});

app.get('/api/liquidations', (req, res) => {
  const all = [
    ...liquidators.ethereum.getStats().recentExecutions,
    ...liquidators.polygon.getStats().recentExecutions,
    ...liquidators.arbitrum.getStats().recentExecutions
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({ count: all.length, liquidations: all.slice(0, 50) });
});

app.post('/api/withdraw', async (req, res) => {
  const { amount } = req.body;

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ success: false, error: 'Enter a valid amount' });
  }

  const result = await treasury.withdraw(Number(amount));
  res.json(result);
});

app.get('/api/withdrawals', (req, res) => {
  res.json({ history: treasury.getHistory() });
});

// Serve dashboard for all non-api routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 All 3 networks active: Ethereum, Polygon, Arbitrum`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
});

module.exports = app;
