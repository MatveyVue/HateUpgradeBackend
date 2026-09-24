const express = require('express');

const userAuth = require('../middleware/userAuth');
const { ok, fail } = require('../utils/response');
const { getOrCreateUser } = require('../services/userService');
const { get, run } = require('../database/db');
const { isGlobalPaused } = require('../utils/pause');

const router = express.Router();

const UPGRADE_COST_NANO = 1000000000000000n; // 1,000,000 SCMD69 (9 decimals)

// Покупка/открытие апгрейда: списывает 1M SCMD с доступного баланса.
router.post('/purchase', userAuth, async (req, res) => {
  try {
    if (isGlobalPaused()) {
      return fail(res, 'GLOBAL_PAUSED', 'Actions are temporarily paused');
    }

    const user = await getOrCreateUser(req.user);

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [user.id]
    );

    const available = BigInt(balance.available_balance || 0);

    if (available < UPGRADE_COST_NANO) {
      return fail(
        res,
        'INSUFFICIENT_BALANCE',
        'Not enough available balance (upgrade costs 1,000,000 SCMD69)'
      );
    }

    const newAvailable = available - UPGRADE_COST_NANO;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE balances
         SET available_balance = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newAvailable.toString(),
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
          'upgrade',
          UPGRADE_COST_NANO.toString(),
          JSON.stringify({ action: 'open_gift' }),
          Date.now()
        ]
      );

      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }

    return ok(res, {
      cost: UPGRADE_COST_NANO.toString(),
      available_balance: newAvailable.toString()
    });
  } catch (err) {
    console.error('UPGRADE PURCHASE ERROR:', err);
    return fail(res, 'UPGRADE_PURCHASE_ERROR', 'Failed to purchase upgrade', 500);
  }
});

module.exports = router;
