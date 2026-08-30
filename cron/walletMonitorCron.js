const cron = require('node-cron');
const { checkHotWalletTonBalance } = require('../services/walletMonitorService');

function startWalletMonitorCron() {
  // Каждые 10 минут
  cron.schedule('*/10 * * * *', async () => {
    try {
      const result = await checkHotWalletTonBalance();

      if (!result.ok) {
        console.error('HOT WALLET TON LOW:', result);
      } else {
        console.log('HOT WALLET TON OK:', result);
      }
    } catch (err) {
      console.error('HOT WALLET MONITOR ERROR:', err.response?.data || err.message || err);
    }
  });

  console.log('HOT WALLET MONITOR ENABLED: every 10 minutes');
}

module.exports = {
  startWalletMonitorCron
};
