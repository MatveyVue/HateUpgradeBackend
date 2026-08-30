const cron = require('node-cron');
const { closeExpiredSeasons } = require('../services/seasonService');

function startSeasonCron() {
  // Проверка каждый час
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('SEASON CRON STARTED');

      const result = await closeExpiredSeasons();

      console.log('SEASON CRON RESULT:', result);
    } catch (err) {
      console.error('SEASON CRON ERROR:', err);
    }
  });

  console.log('SEASON CRON ENABLED: every hour');
}

module.exports = {
  startSeasonCron
};
