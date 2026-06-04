const axios = require('axios');

class TreasuryManager {
  constructor() {
    this.withdrawalHistory = [];
    this.balance = 0;
  }

  async withdraw(amountUSD) {
    try {
      if (!amountUSD || amountUSD <= 0) {
        return { success: false, error: 'Invalid amount' };
      }

      console.log(`💸 Recording withdrawal: $${amountUSD}`);

      const record = {
        timestamp: new Date().toISOString(),
        amountUSD,
        status: 'initiated',
        reference: 'MANUAL_' + Date.now(),
        type: 'bank_transfer'
      };

      this.withdrawalHistory.unshift(record);
      if (this.withdrawalHistory.length > 50) this.withdrawalHistory.pop();

      console.log(`✅ Withdrawal recorded: $${amountUSD} | Ref: ${record.reference}`);
      return { success: true, reference: record.reference };
    } catch (error) {
      const errMsg = error.message || 'Unknown error';
      console.error(`❌ Withdrawal error: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  updateBalance(profitAmount) {
    this.balance += profitAmount;
  }

  getHistory() {
    return this.withdrawalHistory;
  }

  getBalance() {
    return this.balance;
  }
}

module.exports = TreasuryManager;
