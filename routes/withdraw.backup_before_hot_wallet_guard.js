const express = require('express');

const userAuth = require('../middleware/userAuth');
const { ok, fail } = require('../utils/response');
const { getOrCreateUser } = require('../services/userService');
const { get, run, all } = require('../database/db');
const { isWithdrawPaused } = require('../utils/pause');

const router = express.Router();

function isValidTonAddress(address) {
  return typeof address === 'string' && /^(UQ|EQ)[A-Za-z0-9_-]{46,}$/.test(address);
}

router.post('/create', userAuth, async (req, res) => {
  try {
    if (isWithdrawPaused()) {
      return fail(res, 'WITHDRAW_PAUSED', 'Withdrawals are temporarily paused');
    }
    const { amount, address } = req.body;

    if (!amount || !address) {
      return fail(res, 'INVALID_BODY', 'amount and address are required');
    }

    if (!isValidTonAddress(address)) {
      return fail(res, 'INVALID_ADDRESS', 'Invalid TON address');
    }

    const withdrawAmount = BigInt(amount);

    if (withdrawAmount <= 0n) {
      return fail(res, 'INVALID_AMOUNT', 'Amount must be greater than zero');
    }

    const user = await getOrCreateUser(req.user);

    const season = await get(
      `SELECT * FROM staking_seasons ORDER BY id DESC LIMIT 1`
    );

    const minWithdraw = BigInt(
      season ? season.min_withdraw : (process.env.MIN_WITHDRAW_NANO || '1000000000000000')
    );

    if (withdrawAmount < minWithdraw) {
      return fail(res, 'MIN_WITHDRAW_NOT_REACHED', 'Minimum withdraw is 1,000,000 SCMD69');
    }

    const pending = await get(
      `SELECT id FROM withdrawals 
       WHERE user_id = ? AND status IN ('pending', 'processing') 
       LIMIT 1`,
      [user.id]
    );

    if (pending) {
      return fail(res, 'WITHDRAW_IN_PROGRESS', 'You already have a pending withdraw');
    }

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [user.id]
    );

    const available = BigInt(balance.available_balance || 0);

    if (withdrawAmount > available) {
      return fail(res, 'INSUFFICIENT_BALANCE', 'Not enough available balance');
    }

    const newAvailable = available - withdrawAmount;
    const newLocked = BigInt(balance.locked_withdraw_balance || 0) + withdrawAmount;

    await run('BEGIN TRANSACTION');

    try {
      const result = await run(
        `INSERT INTO withdrawals
         (user_id, to_address, amount, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`,
        [
          user.id,
          address,
          withdrawAmount.toString(),
          Date.now()
        ]
      );

      await run(
        `UPDATE balances
         SET available_balance = ?,
             locked_withdraw_balance = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newAvailable.toString(),
          newLocked.toString(),
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
          'withdraw',
          withdrawAmount.toString(),
          JSON.stringify({
            withdrawal_id: result.lastID,
            to_address: address,
            status: 'pending'
          }),
          Date.now()
        ]
      );

      await run('COMMIT');

      return ok(res, {
        withdrawal_id: result.lastID,
        amount: withdrawAmount.toString(),
        address,
        status: 'pending',
        available_balance: newAvailable.toString(),
        locked_withdraw_balance: newLocked.toString()
      });
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('WITHDRAW CREATE ERROR:', err);
    return fail(res, 'WITHDRAW_CREATE_ERROR', 'Failed to create withdraw request', 500);
  }
});

router.get('/history', userAuth, async (req, res) => {
  try {
    const user = await getOrCreateUser(req.user);

    const rows = await all(
      `SELECT id, to_address, amount, tx_hash, status, error, created_at, processed_at
       FROM withdrawals
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 30`,
      [user.id]
    );

    return ok(res, {
      withdrawals: rows
    });
  } catch (err) {
    console.error('WITHDRAW HISTORY ERROR:', err);
    return fail(res, 'WITHDRAW_HISTORY_ERROR', 'Failed to load withdraw history', 500);
  }
});

module.exports = router;
