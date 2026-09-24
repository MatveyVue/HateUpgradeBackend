const express = require('express');

const adminAuth = require('../middleware/adminAuth');
const { ok, fail } = require('../utils/response');
const { get, run, all } = require('../database/db');
const { accrueDailyRewards } = require('../services/rewardService');
const { processPendingWithdrawalsMock, processOnePendingWithdrawalReal } = require('../services/withdrawService');
const { scanDepositsOnce } = require('../services/depositScanner');

const router = express.Router();

function formatNano(value) {
  const n = BigInt(value || 0);
  const whole = n / 1000000000n;
  const frac = n % 1000000000n;

  if (frac === 0n) return whole.toString();

  return `${whole.toString()}.${frac.toString().padStart(9, '0').replace(/0+$/, '')}`;
}



router.post('/start-season', adminAuth, async (req, res) => {
  try {
    const active = await get(
      `SELECT * FROM staking_seasons WHERE status IN ('active', 'paused') ORDER BY id DESC LIMIT 1`
    );

    if (active) {
      return fail(res, 'SEASON_ALREADY_ACTIVE', 'There is already an active or paused season');
    }

    const last = await get(
      `SELECT season_number FROM staking_seasons ORDER BY season_number DESC LIMIT 1`
    );

    const now = Date.now();
    const seasonNumber = last ? Number(last.season_number) + 1 : 1;

    const apyBps = Number(process.env.APY_BPS || 1600);
    const minStake = Number(process.env.MIN_STAKE_NANO || 500000000000000);
    const minWithdraw = Number(process.env.MIN_WITHDRAW_NANO || 1000000000000000);
    const penaltyBps = Number(process.env.UNSTAKE_PENALTY_BPS || 2000);
    const seasonDays = Number(process.env.SEASON_DAYS || 60);

    const endAt = now + seasonDays * 24 * 60 * 60 * 1000;

    const result = await run(
      `INSERT INTO staking_seasons
       (season_number, title, apy_bps, min_stake, min_withdraw, penalty_bps, start_at, end_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        seasonNumber,
        `Season ${seasonNumber}`,
        apyBps,
        minStake,
        minWithdraw,
        penaltyBps,
        now,
        endAt,
        now
      ]
    );

    const season = await get(
      `SELECT * FROM staking_seasons WHERE id = ?`,
      [result.lastID]
    );

    return ok(res, { season });
  } catch (err) {
    console.error('START SEASON ERROR:', err);
    return fail(res, 'START_SEASON_ERROR', 'Failed to start season', 500);
  }
});

router.get('/season', adminAuth, async (req, res) => {
  try {
    const seasons = await all(
      `SELECT * FROM staking_seasons ORDER BY id DESC LIMIT 10`
    );

    return ok(res, { seasons });
  } catch (err) {
    console.error('ADMIN SEASON LIST ERROR:', err);
    return fail(res, 'ADMIN_SEASON_ERROR', 'Failed to load seasons', 500);
  }
});

router.post('/credit-balance', adminAuth, async (req, res) => {
  try {
    const { telegram_id, amount } = req.body;

    if (!telegram_id || !amount) {
      return fail(res, 'INVALID_BODY', 'telegram_id and amount are required');
    }

    const user = await get(
      `SELECT * FROM users WHERE telegram_id = ?`,
      [String(telegram_id)]
    );

    if (!user) {
      return fail(res, 'USER_NOT_FOUND', 'User not found');
    }

    const nanoAmount = BigInt(amount);

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [user.id]
    );

    const newAvailable =
      BigInt(balance.available_balance) + nanoAmount;

    const newDeposited =
      BigInt(balance.total_deposited) + nanoAmount;

    await run(
      `UPDATE balances
       SET available_balance = ?,
           total_deposited = ?,
           updated_at = ?
       WHERE user_id = ?`,
      [
        newAvailable.toString(),
        newDeposited.toString(),
        Date.now(),
        user.id
      ]
    );

    await run(
      `INSERT INTO activity_logs
       (user_id, type, amount, meta, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        user.id,
        'deposit',
        nanoAmount.toString(),
        'admin test deposit',
        Date.now()
      ]
    );

    return ok(res, {
      credited: nanoAmount.toString()
    });
  } catch (err) {
    console.error('CREDIT BALANCE ERROR:', err);
    return fail(res, 'CREDIT_BALANCE_ERROR', 'Failed to credit balance', 500);
  }
});


router.post('/accrue-rewards', adminAuth, async (req, res) => {
  try {
    const result = await accrueDailyRewards();

    return ok(res, result);
  } catch (err) {
    console.error('ADMIN ACCRUE REWARDS ERROR:', err);
    return fail(res, 'ACCRUE_REWARDS_ERROR', 'Failed to accrue rewards', 500);
  }
});



router.post('/process-withdrawals-mock', adminAuth, async (req, res) => {
  try {
    const result = await processPendingWithdrawalsMock();

    return ok(res, result);
  } catch (err) {
    console.error('ADMIN PROCESS WITHDRAWALS MOCK ERROR:', err);
    return fail(res, 'PROCESS_WITHDRAWALS_MOCK_ERROR', 'Failed to process mock withdrawals', 500);
  }
});



router.post('/confirm-deposit-mock', adminAuth, async (req, res) => {
  try {
    const { deposit_id, amount } = req.body;

    if (!deposit_id || !amount) {
      return fail(res, 'INVALID_BODY', 'deposit_id and amount are required');
    }

    const deposit = await get(
      `SELECT * FROM deposits WHERE id = ?`,
      [deposit_id]
    );

    if (!deposit) {
      return fail(res, 'DEPOSIT_NOT_FOUND', 'Deposit not found');
    }

    if (deposit.status !== 'pending') {
      return fail(res, 'DEPOSIT_ALREADY_PROCESSED', 'Deposit is not pending');
    }

    const amountNano = BigInt(amount);

    if (amountNano <= 0n) {
      return fail(res, 'INVALID_AMOUNT', 'Amount must be greater than zero');
    }

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [deposit.user_id]
    );

    const now = Date.now();
    const newAvailable = BigInt(balance.available_balance || 0) + amountNano;
    const newTotalDeposited = BigInt(balance.total_deposited || 0) + amountNano;
    const mockTx = `mock_deposit_${deposit.id}_${now}`;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE deposits
         SET received_amount = ?,
             tx_hash = ?,
             status = 'completed',
             completed_at = ?
         WHERE id = ?`,
        [
          amountNano.toString(),
          mockTx,
          now,
          deposit.id
        ]
      );

      await run(
        `UPDATE balances
         SET available_balance = ?,
             total_deposited = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newAvailable.toString(),
          newTotalDeposited.toString(),
          now,
          deposit.user_id
        ]
      );

      await run(
        `INSERT INTO activity_logs
         (user_id, type, amount, meta, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          deposit.user_id,
          'deposit',
          amountNano.toString(),
          JSON.stringify({
            deposit_id: deposit.id,
            tx_hash: mockTx,
            mode: 'mock'
          }),
          now
        ]
      );

      await run('COMMIT');

      return ok(res, {
        deposit_id: deposit.id,
        credited: amountNano.toString(),
        tx_hash: mockTx,
        available_balance: newAvailable.toString()
      });
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('CONFIRM DEPOSIT MOCK ERROR:', err);
    return fail(res, 'CONFIRM_DEPOSIT_MOCK_ERROR', 'Failed to confirm mock deposit', 500);
  }
});



router.post('/scan-deposits-once', adminAuth, async (req, res) => {
  try {
    const result = await scanDepositsOnce();

    return ok(res, result);
  } catch (err) {
    console.error('ADMIN SCAN DEPOSITS ERROR:', err.response?.data || err.message || err);
    return fail(res, 'SCAN_DEPOSITS_ERROR', 'Failed to scan deposits', 500);
  }
});



router.post('/pause-season', adminAuth, async (req, res) => {
  try {
    const season = await get(
      `SELECT * FROM staking_seasons
       WHERE status = 'active'
       ORDER BY id DESC
       LIMIT 1`
    );

    if (!season) {
      return fail(res, 'NO_ACTIVE_SEASON', 'No active season to pause');
    }

    await run(
      `UPDATE staking_seasons
       SET status = 'paused'
       WHERE id = ?`,
      [season.id]
    );

    const updated = await get(
      `SELECT * FROM staking_seasons WHERE id = ?`,
      [season.id]
    );

    return ok(res, { season: updated });
  } catch (err) {
    console.error('PAUSE SEASON ERROR:', err);
    return fail(res, 'PAUSE_SEASON_ERROR', 'Failed to pause season', 500);
  }
});

router.post('/resume-season', adminAuth, async (req, res) => {
  try {
    const season = await get(
      `SELECT * FROM staking_seasons
       WHERE status = 'paused'
       ORDER BY id DESC
       LIMIT 1`
    );

    if (!season) {
      return fail(res, 'NO_PAUSED_SEASON', 'No paused season to resume');
    }

    if (Date.now() >= Number(season.end_at)) {
      await run(
        `UPDATE staking_seasons
         SET status = 'ended'
         WHERE id = ?`,
        [season.id]
      );

      return fail(res, 'SEASON_ALREADY_ENDED', 'Season end time has already passed');
    }

    await run(
      `UPDATE staking_seasons
       SET status = 'active'
       WHERE id = ?`,
      [season.id]
    );

    const updated = await get(
      `SELECT * FROM staking_seasons WHERE id = ?`,
      [season.id]
    );

    return ok(res, { season: updated });
  } catch (err) {
    console.error('RESUME SEASON ERROR:', err);
    return fail(res, 'RESUME_SEASON_ERROR', 'Failed to resume season', 500);
  }
});



router.post('/end-season', adminAuth, async (req, res) => {
  try {
    const season = await get(
      `SELECT * FROM staking_seasons
       WHERE status IN ('active', 'paused')
       ORDER BY id DESC
       LIMIT 1`
    );

    if (!season) {
      return fail(res, 'NO_ACTIVE_SEASON', 'No active season to end');
    }

    await run(
      `UPDATE staking_seasons
       SET status = 'ended',
           end_at = ?
       WHERE id = ?`,
      [Date.now(), season.id]
    );

    const updated = await get(
      `SELECT * FROM staking_seasons WHERE id = ?`,
      [season.id]
    );

    return ok(res, { season: updated });
  } catch (err) {
    console.error('END SEASON ERROR:', err);
    return fail(res, 'END_SEASON_ERROR', 'Failed to end season', 500);
  }
});

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const users = await get(`SELECT COUNT(*) AS count FROM users`);
    const balances = await get(`
      SELECT
        COALESCE(SUM(CAST(available_balance AS INTEGER)), 0) AS available_total,
        COALESCE(SUM(CAST(active_stake AS INTEGER)), 0) AS active_stake_total,
        COALESCE(SUM(CAST(claimable_rewards AS INTEGER)), 0) AS claimable_total,
        COALESCE(SUM(CAST(locked_withdraw_balance AS INTEGER)), 0) AS locked_withdraw_total,
        COALESCE(SUM(CAST(total_penalty_paid AS INTEGER)), 0) AS penalty_total
      FROM balances
    `);

    const pendingDeposits = await get(
      `SELECT COUNT(*) AS count FROM deposits WHERE status = 'pending'`
    );

    const pendingWithdrawals = await get(
      `SELECT COUNT(*) AS count FROM withdrawals WHERE status IN ('pending', 'processing')`
    );

    const season = await get(
      `SELECT * FROM staking_seasons ORDER BY id DESC LIMIT 1`
    );

    return ok(res, {
      users: users.count,
balances: {
        ...balances,
        available_total_formatted: formatNano(balances.available_total),
        active_stake_total_formatted: formatNano(balances.active_stake_total),
        claimable_total_formatted: formatNano(balances.claimable_total),
        locked_withdraw_total_formatted: formatNano(balances.locked_withdraw_total),
        penalty_total_formatted: formatNano(balances.penalty_total)
      },
      pending_deposits: pendingDeposits.count,
      pending_withdrawals: pendingWithdrawals.count,
      season
    });
  } catch (err) {
    console.error('ADMIN STATS ERROR:', err);
    return fail(res, 'ADMIN_STATS_ERROR', 'Failed to load admin stats', 500);
  }
});



router.post('/process-withdrawal-real-once', adminAuth, async (req, res) => {
  try {
    const result = await processOnePendingWithdrawalReal();

    return ok(res, result);
  } catch (err) {
    console.error('ADMIN PROCESS WITHDRAWAL REAL ERROR:', err.response?.data || err.message || err);
    return fail(res, 'PROCESS_WITHDRAWAL_REAL_ERROR', 'Failed to process real withdrawal', 500);
  }
});


module.exports = router;
