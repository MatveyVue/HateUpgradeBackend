const express = require('express');

const userAuth = require('../middleware/userAuth');
const { ok, fail } = require('../utils/response');
const { getOrCreateUser, getUserBalance } = require('../services/userService');
const { get } = require('../database/db');

const router = express.Router();

function formatNano(value) {
  const n = BigInt(value || 0);
  const whole = n / 1000000000n;
  const frac = n % 1000000000n;

  if (frac === 0n) return whole.toString();

  return `${whole.toString()}.${frac.toString().padStart(9, '0').replace(/0+$/, '')}`;
}

router.get('/', userAuth, async (req, res) => {
  try {
    const user = await getOrCreateUser(req.user);
    const balance = await getUserBalance(user.id);

    const season = await get(
      `SELECT * FROM staking_seasons 
       WHERE status IN ('active', 'paused') 
       ORDER BY id DESC 
       LIMIT 1`
    );

    return ok(res, {
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        wallet_address: user.wallet_address
      },
      balances: {
        available_balance: String(balance.available_balance),
        active_stake: String(balance.active_stake),
        claimable_rewards: String(balance.claimable_rewards),
        locked_withdraw_balance: String(balance.locked_withdraw_balance),

        available_balance_formatted: formatNano(balance.available_balance),
        active_stake_formatted: formatNano(balance.active_stake),
        claimable_rewards_formatted: formatNano(balance.claimable_rewards),
        locked_withdraw_balance_formatted: formatNano(balance.locked_withdraw_balance)
      },
      season: season || null
    });
  } catch (err) {
    console.error('PROFILE ERROR:', err);
    return fail(res, 'PROFILE_ERROR', 'Failed to load profile', 500);
  }
});

router.get('/activity', userAuth, async (req, res) => {
  try {
    const user = await getOrCreateUser(req.user);

    const rows = await require('../database/db').all(
      `SELECT type, amount, meta, created_at 
       FROM activity_logs 
       WHERE user_id = ? 
       ORDER BY id DESC 
       LIMIT 30`,
      [user.id]
    );

    return ok(res, {
      activity: rows
    });
  } catch (err) {
    console.error('ACTIVITY ERROR:', err);
    return fail(res, 'ACTIVITY_ERROR', 'Failed to load activity', 500);
  }
});

module.exports = router;
