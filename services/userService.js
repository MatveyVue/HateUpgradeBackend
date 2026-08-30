const { get, run } = require('../database/db');

async function getOrCreateUser(profile) {
  const now = Date.now();

  let user = await get(
    `SELECT * FROM users WHERE telegram_id = ?`,
    [profile.telegram_id]
  );

  if (!user) {
    const result = await run(
      `INSERT INTO users 
       (telegram_id, username, first_name, last_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        profile.telegram_id,
        profile.username,
        profile.first_name,
        profile.last_name,
        now,
        now
      ]
    );

    await run(
      `INSERT INTO balances (user_id, updated_at) VALUES (?, ?)`,
      [result.lastID, now]
    );

    user = await get(`SELECT * FROM users WHERE id = ?`, [result.lastID]);
  } else {
    await run(
      `UPDATE users 
       SET username = ?, first_name = ?, last_name = ?, updated_at = ?
       WHERE id = ?`,
      [
        profile.username,
        profile.first_name,
        profile.last_name,
        now,
        user.id
      ]
    );

    user = await get(`SELECT * FROM users WHERE id = ?`, [user.id]);
  }

  return user;
}

async function getUserBalance(userId) {
  return get(`SELECT * FROM balances WHERE user_id = ?`, [userId]);
}

module.exports = {
  getOrCreateUser,
  getUserBalance
};
