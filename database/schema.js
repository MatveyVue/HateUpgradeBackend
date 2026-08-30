const { run } = require('./db');

async function initSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      wallet_address TEXT,
      is_banned INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS balances (
      user_id INTEGER PRIMARY KEY,
      available_balance INTEGER DEFAULT 0,
      active_stake INTEGER DEFAULT 0,
      claimable_rewards INTEGER DEFAULT 0,
      locked_withdraw_balance INTEGER DEFAULT 0,
      total_deposited INTEGER DEFAULT 0,
      total_withdrawn INTEGER DEFAULT 0,
      total_claimed INTEGER DEFAULT 0,
      total_penalty_paid INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS staking_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_number INTEGER UNIQUE NOT NULL,
      title TEXT,
      apy_bps INTEGER NOT NULL,
      min_stake INTEGER NOT NULL,
      min_withdraw INTEGER NOT NULL,
      penalty_bps INTEGER NOT NULL,
      start_at INTEGER NOT NULL,
      end_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      memo TEXT UNIQUE NOT NULL,
      expected_amount INTEGER,
      received_amount INTEGER DEFAULT 0,
      tx_hash TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      to_address TEXT NOT NULL,
      amount INTEGER NOT NULL,
      tx_hash TEXT,
      status TEXT DEFAULT 'pending',
      error TEXT,
      created_at INTEGER NOT NULL,
      processed_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS reward_accruals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      stake_amount INTEGER NOT NULL,
      reward_amount INTEGER NOT NULL,
      accrued_for_day INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, season_id, accrued_for_day),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (season_id) REFERENCES staking_seasons(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER DEFAULT 0,
      meta TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS processed_txs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT UNIQUE NOT NULL,
      lt TEXT,
      type TEXT NOT NULL,
      processed_at INTEGER NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  console.log('DATABASE SCHEMA READY');
}

module.exports = {
  initSchema
};
