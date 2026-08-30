const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

function makeBackup() {
  const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/staking.db');
  const backupDir = path.resolve(process.cwd(), './backups');

  if (!fs.existsSync(dbPath)) {
    console.error('BACKUP ERROR: database not found:', dbPath);
    return null;
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const stamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '');

  const backupFile = path.join(backupDir, `staking_${stamp}.db`);

  fs.copyFileSync(dbPath, backupFile);

  console.log('DATABASE BACKUP CREATED:', backupFile);

  return backupFile;
}

function startBackupCron() {
  // Каждый день в 03:00 по времени сервера
  cron.schedule('0 3 * * *', () => {
    try {
      makeBackup();
    } catch (err) {
      console.error('BACKUP CRON ERROR:', err);
    }
  });

  console.log('BACKUP CRON ENABLED: every day at 03:00');
}

module.exports = {
  startBackupCron,
  makeBackup
};
