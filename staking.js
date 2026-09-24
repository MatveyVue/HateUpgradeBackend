const express = require('express');

const userAuth = require('../middleware/userAuth');
const { ok, fail } = require('../utils/response');
const { getOrCreateUser } = require('../services/userService');
const { get, run } = require('../database/db');
const { isClaimPaused, isGlobalPaused } = require('../utils/pause');

const router = express.Router();


function formatNano(value) {
  const n = BigInt(value || 0);
  const whole = n / 1000000000n;
  const frac = n % 1000000000n;

  if (frac === 0n) return whole.toString();

  return `${whole.toString()}.${frac.toString().padStart(9, '0').replace(/0+$/, '')}`;
}

router.get('/info', userAuth, async (req, res) => {
  try {
    const user = await getOrCreateUser(req.user);

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [user.id]
    );

    const season = await get(
      `SELECT * FROM staking_seasons
       ORDER BY id DESC
       LIMIT 1`
    );

    const now = Date.now();

    let daysLeft = 0;
    let seasonProgressPercent = 0;

    if (season) {
      const total = Number(season.end_at) - Number(season.start_at);
      const passed = Math.max(0, now - Number(season.start_at));
      const left = Math.max(0, Number(season.end_at) - now);

      daysLeft = Math.ceil(left / (24 * 60 * 60 * 1000));
      seasonProgressPercent = total > 0 ? Math.min(100, Math.floor((passed / total) * 100)) : 0;
    }

    return ok(res, {
      active_stake: String(balance.active_stake),
      active_stake_formatted: formatNano(balance.active_stake),

      claimable_rewards: String(balance.claimable_rewards),
      claimable_rewards_formatted: formatNano(balance.claimable_rewards),

      available_balance: String(balance.available_balance),
      available_balance_formatted: formatNano(balance.available_balance),

      staking: {
        can_stake: !!season && season.status === 'active',
        can_restake: !!season && season.status === 'active',
        can_unstake: !!season && BigInt(balance.active_stake || 0) > 0n,
        can_claim: BigInt(balance.claimable_rewards || 0) > 0n
      },

      season: season
        ? {
            id: season.id,
            season_number: season.season_number,
            title: season.title,
            status: season.status,
            apy_bps: season.apy_bps,
            apy_percent: Number(season.apy_bps) / 100,
            min_stake: String(season.min_stake),
            min_stake_formatted: formatNano(season.min_stake),
            min_withdraw: String(season.min_withdraw),
            min_withdraw_formatted: formatNano(season.min_withdraw),
            penalty_bps: season.penalty_bps,
            penalty_percent: Number(season.penalty_bps) / 100,
            start_at: season.start_at,
            end_at: season.end_at,
            days_left: daysLeft,
            progress_percent: seasonProgressPercent
          }
        : null
    });
  } catch (err) {
    console.error('STAKING INFO ERROR:', err);
    return fail(res, 'STAKING_INFO_ERROR', 'Failed to load staking info', 500);
  }
});


router.post('/stake', userAuth, async (req, res) => {
  try {
    if (isGlobalPaused()) {
      return fail(res, 'STAKING_PAUSED', 'Staking is temporarily paused');
    }
    const { amount } = req.body;

    if (!amount) {
      return fail(res, 'INVALID_AMOUNT', 'Amount is required');
    }

    const stakeAmount = BigInt(amount);

    if (stakeAmount <= 0n) {
      return fail(res, 'INVALID_AMOUNT', 'Amount must be greater than zero');
    }

    const user = await getOrCreateUser(req.user);

    const season = await get(
      `SELECT * FROM staking_seasons 
       WHERE status = 'active' 
       ORDER BY id DESC 
       LIMIT 1`
    );

    if (!season) {
      return fail(res, 'SEASON_CLOSED', 'Staking season is not active');
    }

    const minStake = BigInt(season.min_stake);

    if (stakeAmount < minStake) {
      return fail(res, 'MIN_STAKE_NOT_REACHED', 'Minimum stake is 500,000 SCMD69');
    }

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [user.id]
    );

    const available = BigInt(balance.available_balance || 0);

    if (stakeAmount > available) {
      return fail(res, 'INSUFFICIENT_BALANCE', 'Not enough available balance');
    }

    const newAvailable = available - stakeAmount;
    const newActiveStake = BigInt(balance.active_stake || 0) + stakeAmount;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE balances
         SET available_balance = ?,
             active_stake = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newAvailable.toString(),
          newActiveStake.toString(),
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
          'stake',
          stakeAmount.toString(),
          JSON.stringify({ season_id: season.id }),
          Date.now()
        ]
      );

      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }

    return ok(res, {
      staked: stakeAmount.toString(),
      available_balance: newAvailable.toString(),
      active_stake: newActiveStake.toString()
    });
  } catch (err) {
    console.error('STAKE ERROR:', err);
    return fail(res, 'STAKE_ERROR', 'Failed to stake', 500);
  }
});


router.post('/restake', userAuth, async (req, res) => {
  try {
    if (isGlobalPaused()) {
      return fail(res, 'STAKING_PAUSED', 'Staking is temporarily paused');
    }
    const { amount } = req.body;

    if (!amount) {
      return fail(res, 'INVALID_AMOUNT', 'Amount is required');
    }

    const restakeAmount = BigInt(amount);

    if (restakeAmount <= 0n) {
      return fail(res, 'INVALID_AMOUNT', 'Amount must be greater than zero');
    }

    const user = await getOrCreateUser(req.user);

    const season = await get(
      `SELECT * FROM staking_seasons 
       WHERE status = 'active' 
       ORDER BY id DESC 
       LIMIT 1`
    );

    if (!season) {
      return fail(res, 'SEASON_CLOSED', 'Staking season is not active');
    }

    const minStake = BigInt(season.min_stake);

    if (restakeAmount < minStake) {
      return fail(res, 'MIN_STAKE_NOT_REACHED', 'Minimum restake is 500,000 SCMD69');
    }

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [user.id]
    );

    const available = BigInt(balance.available_balance || 0);

    if (restakeAmount > available) {
      return fail(res, 'INSUFFICIENT_BALANCE', 'Not enough available balance');
    }

    const newAvailable = available - restakeAmount;
    const newActiveStake = BigInt(balance.active_stake || 0) + restakeAmount;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE balances
         SET available_balance = ?,
             active_stake = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newAvailable.toString(),
          newActiveStake.toString(),
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
          'restake',
          restakeAmount.toString(),
          JSON.stringify({ season_id: season.id }),
          Date.now()
        ]
      );

      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }

    return ok(res, {
      restaked: restakeAmount.toString(),
      available_balance: newAvailable.toString(),
      active_stake: newActiveStake.toString()
    });
  } catch (err) {
    console.error('RESTAKE ERROR:', err);
    return fail(res, 'RESTAKE_ERROR', 'Failed to restake', 500);
  }
});



router.post('/unstake', userAuth, async (req, res) => {
  try {
    if (isGlobalPaused()) {
      return fail(res, 'STAKING_PAUSED', 'Staking is temporarily paused');
    }
    const { amount } = req.body;

    if (!amount) {
      return fail(res, 'INVALID_AMOUNT', 'Amount is required');
    }

    const unstakeAmount = BigInt(amount);

    if (unstakeAmount <= 0n) {
      return fail(res, 'INVALID_AMOUNT', 'Amount must be greater than zero');
    }

    const user = await getOrCreateUser(req.user);

    const season = await get(
      `SELECT * FROM staking_seasons 
       ORDER BY id DESC 
       LIMIT 1`
    );

    if (!season) {
      return fail(res, 'SEASON_NOT_FOUND', 'Staking season not found');
    }

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [user.id]
    );

    const activeStake = BigInt(balance.active_stake || 0);

    if (unstakeAmount > activeStake) {
      return fail(res, 'INSUFFICIENT_STAKE', 'Not enough active stake');
    }

    const now = Date.now();
    const isPenalty = season.status === 'active' && now < Number(season.end_at);

    let penalty = 0n;
    let returned = unstakeAmount;

    if (isPenalty) {
      penalty = (unstakeAmount * BigInt(season.penalty_bps)) / 10000n;
      returned = unstakeAmount - penalty;
    }

    const newActiveStake = activeStake - unstakeAmount;
    const newAvailable = BigInt(balance.available_balance || 0) + returned;
    const newPenaltyPaid = BigInt(balance.total_penalty_paid || 0) + penalty;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE balances
         SET available_balance = ?,
             active_stake = ?,
             total_penalty_paid = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newAvailable.toString(),
          newActiveStake.toString(),
          newPenaltyPaid.toString(),
          now,
          user.id
        ]
      );

      await run(
        `INSERT INTO activity_logs
         (user_id, type, amount, meta, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          user.id,
          'unstake',
          unstakeAmount.toString(),
          JSON.stringify({
            season_id: season.id,
            penalty: penalty.toString(),
            returned: returned.toString(),
            penalty_applied: isPenalty
          }),
          now
        ]
      );

      if (penalty > 0n) {
        await run(
          `INSERT INTO activity_logs
           (user_id, type, amount, meta, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            user.id,
            'penalty',
            penalty.toString(),
            JSON.stringify({
              season_id: season.id,
              reason: 'early_unstake'
            }),
            now
          ]
        );
      }

      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }

    return ok(res, {
      unstaked: unstakeAmount.toString(),
      returned: returned.toString(),
      penalty: penalty.toString(),
      penalty_applied: isPenalty,
      available_balance: newAvailable.toString(),
      active_stake: newActiveStake.toString()
    });
  } catch (err) {
    console.error('UNSTAKE ERROR:', err);
    return fail(res, 'UNSTAKE_ERROR', 'Failed to unstake', 500);
  }
});



router.post('/claim', userAuth, async (req, res) => {
  try {
    if (isClaimPaused()) {
      return fail(res, 'CLAIM_PAUSED', 'Claims are temporarily paused');
    }
    const user = await getOrCreateUser(req.user);

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [user.id]
    );

    const claimable = BigInt(balance.claimable_rewards || 0);

    if (claimable <= 0n) {
      return fail(res, 'NOTHING_TO_CLAIM', 'No rewards available to claim');
    }

    const newAvailable = BigInt(balance.available_balance || 0) + claimable;
    const newTotalClaimed = BigInt(balance.total_claimed || 0) + claimable;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE balances
         SET available_balance = ?,
             claimable_rewards = ?,
             total_claimed = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newAvailable.toString(),
          '0',
          newTotalClaimed.toString(),
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
          'claim',
          claimable.toString(),
          JSON.stringify({ source: 'staking_rewards' }),
          Date.now()
        ]
      );

      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }

    return ok(res, {
      claimed: claimable.toString(),
      available_balance: newAvailable.toString(),
      claimable_rewards: '0'
    });
  } catch (err) {
    console.error('CLAIM ERROR:', err);
    return fail(res, 'CLAIM_ERROR', 'Failed to claim rewards', 500);
  }
});


module.exports = router;
