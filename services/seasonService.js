const { all, run } = require('../database/db');

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
  closeExpiredSeasons
};
