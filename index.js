require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { initSchema } = require('./database/schema');
const { ok } = require('./utils/response');
const { apiLimiter, sensitiveLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const stakingRoutes = require('./routes/staking');
const withdrawRoutes = require('./routes/withdraw');
const depositRoutes = require('./routes/deposit');
const upgradeRoutes = require('./routes/upgrade');
const { startRewardCron } = require('./cron/rewardCron');
const { startDepositCron } = require('./cron/depositCron');
const { startBackupCron } = require('./cron/backupCron');
const { startSeasonCron } = require('./cron/seasonCron');
const { startWithdrawCron } = require('./cron/withdrawCron');
const { startWalletMonitorCron } = require('./cron/walletMonitorCron');
const { startWithdrawConfirmCron } = require('./cron/withdrawConfirmCron');

const app = express();

app.use(cors({
  origin: 'https://hatestake.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(apiLimiter);

app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/admin', adminRoutes);
app.use('/staking', sensitiveLimiter, stakingRoutes);
app.use('/withdraw', sensitiveLimiter, withdrawRoutes);
app.use('/deposit', sensitiveLimiter, depositRoutes);
app.use('/upgrade', sensitiveLimiter, upgradeRoutes);

app.get('/health', (req, res) => {
  return ok(res, {
    status: 'online',
    service: 'scmd69-staking',
    time: Date.now()
  });
});

async function start() {
  await initSchema();

  const port = Number(process.env.PORT || 3000);

  startRewardCron();
  startDepositCron();
  startBackupCron();
  startSeasonCron();
  startWithdrawCron();
  startWalletMonitorCron();
  startWithdrawConfirmCron();

  app.listen(port, () => {
    console.log(`SCMD69 STAKING BACKEND STARTED ON PORT ${port}`);
  });
}

start().catch((err) => {
  console.error('SERVER START ERROR:', err);
  process.exit(1);
});
