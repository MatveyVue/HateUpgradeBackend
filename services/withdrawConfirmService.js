const { all, run, get } = require('../database/db');
const { getAccountEvents, extractJettonTransfers } = require('./tonService');

function getTransferTimeMs(t) {
  const raw =
    t.timestamp ||
    t.utime ||
    t.time ||
    t.created_at ||
    null;

  if (!raw) return 0;

  const n = Number(raw);

  if (!Number.isFinite(n)) return 0;

  return n < 10000000000 ? n * 1000 : n;
}

async function isTxHashAlreadyUsed(txHash, withdrawalId) {
  if (!txHash) return false;

  const row = await get(
    `SELECT id FROM withdrawals
     WHERE tx_hash = ?
       AND id != ?
       AND status = 'completed'
     LIMIT 1`,
    [txHash, withdrawalId]
  );

  return !!row;
}

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

    const minTime = Number(w.processed_at || w.created_at || 0) - 30000;

    let match = null;

    for (const t of transfers) {
      if (String(t.amount) !== String(w.amount)) {
        continue;
      }

      const txHash = t.tx_hash || t.event_id || null;

      if (await isTxHashAlreadyUsed(txHash, w.id)) {
        continue;
      }

      const transferTime = getTransferTimeMs(t);

      if (transferTime && transferTime < minTime) {
        continue;
      }

      match = t;
      break;
    }

    if (!match) {
      continue;
    }

    const now = Date.now();
    const realHash = match.tx_hash || match.event_id || w.tx_hash;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE withdrawals
         SET status = 'completed',
             tx_hash = ?,
             processed_at = ?
         WHERE id = ?
           AND status = 'sent'`,
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
            mode: 'tonapi_confirmed_strict'
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
