const express = require('express');
const crypto = require('crypto');

const userAuth = require('../middleware/userAuth');
const { ok, fail } = require('../utils/response');
const { getOrCreateUser } = require('../services/userService');
const { run, all } = require('../database/db');
const { isDepositPaused } = require('../utils/pause');

const router = express.Router();

router.post('/create', userAuth, async (req, res) => {
  try {
    if (isDepositPaused()) {
      return fail(res, 'DEPOSIT_PAUSED', 'Deposits are temporarily paused');
    }
    const user = await getOrCreateUser(req.user);

    const now = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    const memo = `SCMD69_${user.telegram_id}_${now}_${random}`;

    const result = await run(
      `INSERT INTO deposits
       (user_id, memo, expected_amount, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`,
      [
        user.id,
        memo,
        null,
        now
      ]
    );

    return ok(res, {
      deposit_id: result.lastID,
      wallet: process.env.STAKING_WALLET_ADDRESS,
      jetton_master: process.env.SCMD69_JETTON_MASTER,
      memo,
      status: 'pending'
    });
  } catch (err) {
    console.error('DEPOSIT CREATE ERROR:', err);
    return fail(res, 'DEPOSIT_CREATE_ERROR', 'Failed to create deposit', 500);
  }
});

router.get('/history', userAuth, async (req, res) => {
  try {
    const user = await getOrCreateUser(req.user);

    const rows = await all(
      `SELECT id, memo, expected_amount, received_amount, tx_hash, status, created_at, completed_at
       FROM deposits
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 30`,
      [user.id]
    );

    return ok(res, {
      deposits: rows
    });
  } catch (err) {
    console.error('DEPOSIT HISTORY ERROR:', err);
    return fail(res, 'DEPOSIT_HISTORY_ERROR', 'Failed to load deposit history', 500);
  }
});

module.exports = router;
