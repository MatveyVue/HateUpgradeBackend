const { get, all, run } = require('../database/db');

function getDayKey(timestamp) {
  const d = new Date(timestamp);
  return Number(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  );
}

async function accrueDailyRewards() {
  const now = Date.now();

  const season = await get(
    `SELECT * FROM staking_seasons 
     WHERE status = 'active' 
     ORDER BY id DESC 
     LIMIT 1`
  );

  if (!season) {
    return {
      accrued_users: 0,
      total_reward: '0',
      reason: 'NO_ACTIVE_SEASON'
    };
  }

  if (now > Number(season.end_at)) {
    return {
      accrued_users: 0,
      total_reward: '0',
      reason: 'SEASON_ENDED'
    };
  }

  const dayKey = getDayKey(now);

  const users = await all(
    `SELECT b.user_id, b.active_stake, b.claimable_rewards
     FROM balances b
     WHERE CAST(b.active_stake AS INTEGER) > 0`
  );

  let accruedUsers = 0;
  let totalReward = 0n;

  for (const row of users) {
    const activeStake = BigInt(row.active_stake || 0);

    if (activeStake <= 0n) continue;

    const existing = await get(
      `SELECT id FROM reward_accruals 
       WHERE user_id = ? AND season_id = ? AND accrued_for_day = ?`,
      [row.user_id, season.id, dayKey]
    );

    if (existing) continue;

    const reward =
      (activeStake * BigInt(season.apy_bps)) / 10000n / 365n;

    if (reward <= 0n) continue;

    const newClaimable = BigInt(row.claimable_rewards || 0) + reward;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `INSERT INTO reward_accruals
         (user_id, season_id, stake_amount, reward_amount, accrued_for_day, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          row.user_id,
          season.id,
          activeStake.toString(),
          reward.toString(),
          dayKey,
          now
        ]
      );

      await run(
        `UPDATE balances
         SET claimable_rewards = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newClaimable.toString(),
          now,
          row.user_id
        ]
      );

      await run(
        `INSERT INTO activity_logs
         (user_id, type, amount, meta, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          row.user_id,
          'reward_accrued',
          reward.toString(),
          JSON.stringify({
            season_id: season.id,
            stake_amount: activeStake.toString(),
            day: dayKey
          }),
          now
        ]
      );

      await run('COMMIT');

      accruedUsers += 1;
      totalReward += reward;
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
  }

  return {
    accrued_users: accruedUsers,
    total_reward: totalReward.toString(),
    day: dayKey
  };
}

module.exports = {
  accrueDailyRewards
};
