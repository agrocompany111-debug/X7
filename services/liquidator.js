const axios = require('axios');
const { ethers } = require('ethers');

const AAVE_POOL_ABI = [
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken) external returns (uint256)',
  'function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint8 decimals, uint8 eModeCategoryId) data)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

class Liquidator {
  constructor(networkName, networkConfig) {
    this.networkName = networkName;
    this.config = networkConfig;
    this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    
    // Initialize wallet if PRIVATE_KEY is available
    if (process.env.PRIVATE_KEY) {
      try {
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.aavePoolWithSigner = new ethers.Contract(
          networkConfig.aavePoolAddress,
          AAVE_POOL_ABI,
          this.wallet
        );
        console.log(`[${this.networkName}] ✅ Wallet initialized: ${this.wallet.address}`);
      } catch (err) {
        console.error(`[${this.networkName}] ❌ Wallet init failed:`, err.message);
        this.wallet = null;
        this.aavePoolWithSigner = null;
      }
    } else {
      console.warn(`[${this.networkName}] ⚠️  No PRIVATE_KEY - monitoring only (no execution)`);
      this.wallet = null;
      this.aavePoolWithSigner = null;
    }

    this.aavePool = new ethers.Contract(networkConfig.aavePoolAddress, AAVE_POOL_ABI, this.provider);
    this.executions = [];
    this.stats = { total: 0, successful: 0, failed: 0, totalProfit: 0, totalGas: 0 };
  }

  async findUnderwaterPositions() {
    try {
      const query = `{
        users(
          first: 100
          where: { borrowedReservesCount_gt: 0 }
          orderBy: id
          orderDirection: desc
        ) {
          id
          borrowedReservesCount
          reserves {
            currentVariableDebt
            currentStableDebt
            reserve {
              id
              symbol
              decimals
              underlyingAsset
              liquidationBonus
              liquidationThreshold
            }
            usageAsCollateralEnabledOnUser
            currentATokenBalance
          }
        }
      }`;

      const response = await axios.post(
        this.config.aaveSubgraph,
        { query },
        { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.data?.data?.users) {
        console.log(`[${this.networkName}] No subgraph data`);
        return [];
      }

      const users = response.data.data.users;
      const underwater = [];

      for (const user of users) {
        try {
          const data = await this.aavePool.getUserAccountData(user.id);
          const healthFactor = Number(data.healthFactor) / 1e18;

          if (healthFactor < 1.0 && healthFactor > 0) {
            const totalDebt = Number(data.totalDebtBase);
            const totalCollateral = Number(data.totalCollateralBase);

            if (totalDebt === 0 || totalCollateral === 0) continue;

            const debtReserve = user.reserves.find(r =>
              Number(r.currentVariableDebt) > 0 || Number(r.currentStableDebt) > 0
            );
            const collateralReserve = user.reserves.find(r =>
              r.usageAsCollateralEnabledOnUser && Number(r.currentATokenBalance) > 0
            );

            if (debtReserve && collateralReserve) {
              underwater.push({
                borrower: user.id,
                healthFactor,
                totalDebt,
                totalCollateral,
                debtAsset: debtReserve.reserve.underlyingAsset,
                debtAssetSymbol: debtReserve.reserve.symbol,
                debtDecimals: parseInt(debtReserve.reserve.decimals),
                debtAmount: Math.max(
                  Number(debtReserve.currentVariableDebt),
                  Number(debtReserve.currentStableDebt)
                ),
                collateralAsset: collateralReserve.reserve.underlyingAsset,
                collateralSymbol: collateralReserve.reserve.symbol,
                collateralAmount: Number(collateralReserve.currentATokenBalance),
                network: this.networkName
              });
            }
          }
        } catch (err) {
          // Skip individual position errors
        }
      }

      console.log(`[${this.networkName}] Found ${underwater.length} underwater positions`);
      return underwater;
    } catch (error) {
      console.error(`[${this.networkName}] Subgraph error:`, error.message);
      return [];
    }
  }

  async calculateProfit(position) {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = Number(feeData.gasPrice || 0);
      const gasUnits = 500000;
      const gasCostWei = gasPrice * BigInt(gasUnits);
      const gasCostEth = Number(ethers.formatEther(gasCostWei));
      const ethPrice = await this.getEthPrice();
      const gasCostUSD = gasCostEth * ethPrice;

      const debtToCover = BigInt(Math.floor(position.debtAmount / 2));
      const liquidationBonusRate = this.config.liquidationBonus;
      const grossProfitCollateral = debtToCover * BigInt(Math.floor((1 + liquidationBonusRate) * 1e4)) / BigInt(1e4);
      const grossProfitUSD = Number(ethers.formatUnits(grossProfitCollateral, position.debtDecimals)) * ethPrice;
      const netProfitUSD = grossProfitUSD - gasCostUSD - 50;

      return {
        debtToCover: debtToCover.toString(),
        grossProfitUSD: Math.max(0, grossProfitUSD),
        gasCostUSD: Math.max(0, gasCostUSD),
        netProfitUSD,
        profitable: netProfitUSD > this.config.minProfitUSD
      };
    } catch (error) {
      console.error(`[${this.networkName}] Profit calc error:`, error.message);
      return { profitable: false, netProfitUSD: 0, gasCostUSD: 0, grossProfitUSD: 0, debtToCover: '0' };
    }
  }

  async getEthPrice() {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,matic-network,arbitrum&vs_currencies=usd',
        { timeout: 5000 }
      );
      
      switch (this.networkName) {
        case 'polygon':
          return response.data['matic-network']?.usd || 0.8;
        case 'arbitrum':
          return response.data.arbitrum?.usd || 2000;
        default:
          return response.data.ethereum?.usd || 2000;
      }
    } catch {
      return this.networkName === 'polygon' ? 0.8 : 2000;
    }
  }

  async approveToken(tokenAddress, spender, amount) {
    try {
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet);
      
      const currentAllowance = await token.allowance(this.wallet.address, spender);
      
      if (currentAllowance >= BigInt(amount)) {
        console.log(`[${this.networkName}] ✅ Token already approved`);
        return true;
      }

      console.log(`[${this.networkName}] 🔓 Approving token for ${spender.slice(0, 8)}...`);
      
      const approveTx = await token.approve(spender, ethers.MaxUint256, {
        gasLimit: 100000
      });
      
      await approveTx.wait();
      console.log(`[${this.networkName}] ✅ Approval tx: ${approveTx.hash}`);
      
      return true;
    } catch (error) {
      console.error(`[${this.networkName}] ❌ Approval failed:`, error.message);
      return false;
    }
  }

  async executeLiquidation(position, profitData) {
    try {
      if (!this.wallet) {
        console.log(`[${this.networkName}] ⚠️  No wallet - skipping execution`);
        return { success: false, error: 'No wallet configured', txHash: null };
      }

      console.log(`[${this.networkName}] 💥 Executing liquidation for ${position.borrower.slice(0, 8)}...`);

      const approved = await this.approveToken(
        position.debtAsset,
        this.config.aavePoolAddress,
        profitData.debtToCover
      );

      if (!approved) {
        return { success: false, error: 'Token approval failed', txHash: null };
      }

      console.log(`[${this.networkName}] 📤 Submitting liquidationCall...`);
      
      const tx = await this.aavePoolWithSigner.liquidationCall(
        position.collateralAsset,
        position.debtAsset,
        position.borrower,
        profitData.debtToCover,
        false,
        {
          gasLimit: 400000,
          gasPrice: (await this.provider.getFeeData()).gasPrice
        }
      );

      console.log(`[${this.networkName}] ⏳ Waiting for confirmation: ${tx.hash}`);
      
      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        console.log(`[${this.networkName}] ✅ EXECUTED! Tx: ${tx.hash} | Block: ${receipt.blockNumber}`);
        return { success: true, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } else {
        console.log(`[${this.networkName}] ❌ Transaction reverted`);
        return { success: false, error: 'Transaction reverted', txHash: tx.hash };
      }
    } catch (error) {
      const errorMsg = error.reason || error.message || 'Unknown error';
      console.error(`[${this.networkName}] ❌ Execution error:`, errorMsg);
      return { success: false, error: errorMsg, txHash: null };
    }
  }

  async processPosition(position) {
    const profitData = await this.calculateProfit(position);

    if (!profitData.profitable) {
      console.log(`[${this.networkName}] Skip ${position.borrower.slice(0, 8)}... - Not profitable ($${profitData.netProfitUSD?.toFixed(2)})`);
      return null;
    }

    console.log(`[${this.networkName}] 🎯 Found liquidation: ${position.borrower.slice(0, 8)}... HF=${position.healthFactor.toFixed(4)} Est profit=$${profitData.netProfitUSD.toFixed(2)}`);

    let result = { success: false, txHash: null, error: 'No execution' };
    if (this.wallet) {
      result = await this.executeLiquidation(position, profitData);
    }

    const execution = {
      timestamp: new Date().toISOString(),
      network: this.networkName,
      borrower: position.borrower,
      debtAsset: position.debtAssetSymbol,
      collateralAsset: position.collateralSymbol,
      healthFactor: position.healthFactor.toFixed(4),
      grossProfitUSD: profitData.grossProfitUSD.toFixed(2),
      gasCostUSD: profitData.gasCostUSD.toFixed(2),
      netProfitUSD: profitData.netProfitUSD.toFixed(2),
      txHash: result.txHash || null,
      scanUrl: result.txHash ? `${this.config.scanBaseUrl}${result.txHash}` : null,
      status: result.success ? 'executed' : 'identified',
      error: result.error || null
    };

    this.executions.unshift(execution);
    if (this.executions.length > 200) this.executions.pop();

    this.stats.total++;
    if (result.success) {
      this.stats.successful++;
      this.stats.totalProfit += profitData.netProfitUSD;
      this.stats.totalGas += profitData.gasCostUSD;
    } else {
      this.stats.failed++;
    }

    return execution;
  }

  async run() {
    console.log(`🚀 [${this.networkName}] Liquidator started (${this.wallet ? 'EXECUTION ENABLED' : 'MONITORING ONLY'})`);

    const scan = async () => {
      try {
        const positions = await this.findUnderwaterPositions();
        for (const position of positions.slice(0, 3)) {
          await this.processPosition(position);
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (error) {
        console.error(`[${this.networkName}] Scan error:`, error.message);
      }
    };

    await scan();
    setInterval(scan, 30000);
  }

  getStats() {
    return {
      network: this.networkName,
      ...this.stats,
      successRate: this.stats.total > 0
        ? ((this.stats.successful / this.stats.total) * 100).toFixed(1) + '%'
        : '0%',
      recentExecutions: this.executions.slice(0, 20)
    };
  }
}

module.exports = Liquidator;
