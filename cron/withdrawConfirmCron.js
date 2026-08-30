const cron = require('node-cron');
const { confirmSentWithdrawals } = require('../services/withdrawConfirmService');

let isRunning = false;

function startWithdrawConfirmCron() {
  cron.schedule('* * * * *', async () => {
    if (isRunning) {
      console.log('WITHDRAW CONFIRM SKIPPED: already running');
      return;
    }

    isRunning = true;

    try {
      console.log('WITHDRAW CONFIRM STARTED');

      const result = await confirmSentWithdrawals();

      console.log('WITHDRAW CONFIRM RESULT:', result);
    } catch (err) {
      console.error('WITHDRAW CONFIRM ERROR:', err.response?.data || err.message || err);
    } finally {
      isRunning = false;
    }
  });

  console.log('WITHDRAW CONFIRM ENABLED: every 60 seconds');
}

module.exports = {
  startWithdrawConfirmCron
};
