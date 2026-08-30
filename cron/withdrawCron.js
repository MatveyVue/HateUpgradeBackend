const cron = require('node-cron');
const { processOnePendingWithdrawalReal } = require('../services/withdrawService');
const { isWithdrawPaused } = require('../utils/pause');

let isRunning = false;

function startWithdrawCron() {
  // Каждую минуту
  cron.schedule('* * * * *', async () => {
    if (isRunning) {
      console.log('WITHDRAW PROCESSOR SKIPPED: already running');
      return;
    }

    if (isWithdrawPaused()) {
      console.log('WITHDRAW PROCESSOR PAUSED');
      return;
    }

    isRunning = true;

    try {
      console.log('WITHDRAW PROCESSOR STARTED');

      const result = await processOnePendingWithdrawalReal();

      console.log('WITHDRAW PROCESSOR RESULT:', result);
    } catch (err) {
      console.error('WITHDRAW PROCESSOR ERROR:', err.response?.data || err.message || err);
    } finally {
      isRunning = false;
    }
  });

  console.log('REAL WITHDRAW PROCESSOR ENABLED: every 60 seconds');
}

module.exports = {
  startWithdrawCron
};
