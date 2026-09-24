const { all, run, get } = require('../database/db');

async function closeExpiredSeasons() {
  const now = Date.now();

  const seasons = await all(
    `SELECT * FROM staking_seasons
     WHERE status = 'active'
       AND end_at <= ?`,
    [now]
  );

  let closed = 0;

  for (const season of seasons) {
    await run(
      `UPDATE staking_seasons
       SET status = 'ended'
       WHERE id = ?`,
      [season.id]
    );

    closed += 1;
  }

  return {
    closed
  };
}

module.exports = {
  closeExpiredSeasons,
  autoStartSeason
};

async function autoStartSeason() {
  const active = await get(
    `SELECT * FROM staking_seasons WHERE status IN ('active', 'paused') ORDER BY id DESC LIMIT 1`
  );

  if (active) {
    return { started: false, reason: 'already_active', season: active };
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

  console.log(`SEASON AUTO-STARTED: Season ${seasonNumber} until ${new Date(endAt).toISOString()}`);

  return { started: true, reason: 'auto_started', season };
}
