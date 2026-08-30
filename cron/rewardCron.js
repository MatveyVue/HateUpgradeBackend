const cron = require('node-cron');
const { accrueDailyRewards } = require('../services/rewardService');

function startRewardCron() {
  // Каждый день в 00:05 по времени сервера
  cron.schedule('5 0 * * *', async () => {
    try {
      console.log('REWARD CRON STARTED');
      const result = await accrueDailyRewards();
      console.log('REWARD CRON RESULT:', result);
    } catch (err) {
      console.error('REWARD CRON ERROR:', err);
    }
  });

  console.log('REWARD CRON ENABLED: every day at 00:05');
}

module.exports = {
  startRewardCron
};
