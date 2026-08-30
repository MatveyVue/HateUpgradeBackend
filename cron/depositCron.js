const cron = require('node-cron');
const { scanDepositsOnce } = require('../services/depositScanner');

function startDepositCron() {
  // Каждую минуту
  cron.schedule('* * * * *', async () => {
    try {
      console.log('DEPOSIT SCAN STARTED');

      const result = await scanDepositsOnce();

      console.log('DEPOSIT SCAN RESULT:', result);
    } catch (err) {
      console.error(
        'DEPOSIT SCAN ERROR:',
        err.response?.data || err.message || err
      );
    }
  });

  console.log('DEPOSIT SCANNER ENABLED: every 60 seconds');
}

module.exports = {
  startDepositCron
};
