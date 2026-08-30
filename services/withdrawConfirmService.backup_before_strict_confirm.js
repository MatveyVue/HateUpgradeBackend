const { all, run } = require('../database/db');
const { getAccountEvents, extractJettonTransfers } = require('./tonService');

async function confirmSentWithdrawals() {
  const rows = await all(
    `SELECT * FROM withdrawals
     WHERE status = 'sent'
     ORDER BY id ASC
     LIMIT 10`
  );

  let confirmed = 0;

  for (const w of rows) {
    const events = await getAccountEvents(w.to_address, 50);
    const transfers = extractJettonTransfers(events);

    const match = transfers.find((t) => {
      return String(t.amount) === String(w.amount);
    });

    if (!match) {
      continue;
    }

    const now = Date.now();
    const realHash = match.tx_hash || w.tx_hash;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE withdrawals
         SET status = 'completed',
             tx_hash = ?,
             processed_at = ?
         WHERE id = ?`,
        [
          realHash,
          now,
          w.id
        ]
      );

      await run(
        `INSERT INTO activity_logs
         (user_id, type, amount, meta, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          w.user_id,
          'withdraw_confirmed',
          String(w.amount),
          JSON.stringify({
            withdrawal_id: w.id,
            tx_hash: realHash,
            mode: 'tonapi_confirmed'
          }),
          now
        ]
      );

      await run('COMMIT');
      confirmed += 1;
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
  }

  return {
    checked: rows.length,
    confirmed
  };
}

module.exports = {
  confirmSentWithdrawals
};
