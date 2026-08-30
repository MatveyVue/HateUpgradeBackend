const { get, all, run } = require('../database/db');
const { getAccountEvents, extractJettonTransfers } = require('./tonService');

async function scanDepositsOnce() {
  const stakingWallet = process.env.STAKING_WALLET_ADDRESS;

  if (!stakingWallet) {
    return {
      processed: 0,
      reason: 'STAKING_WALLET_NOT_CONFIGURED'
    };
  }

  const events = await getAccountEvents(stakingWallet, 50);
  const transfers = extractJettonTransfers(events);

  let processed = 0;

  const pendingDeposits = await all(
    `SELECT * FROM deposits WHERE status = 'pending' ORDER BY id ASC LIMIT 100`
  );

  for (const deposit of pendingDeposits) {
    const match = transfers.find((t) => t.comment === deposit.memo);

    if (!match) continue;

    const txHash = match.tx_hash || `event_${match.event_id}`;

    const already = await get(
      `SELECT id FROM processed_txs WHERE tx_hash = ?`,
      [txHash]
    );

    if (already) continue;

    const amountNano = BigInt(match.amount || 0);

    if (amountNano <= 0n) continue;

    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [deposit.user_id]
    );

    const now = Date.now();

    const newAvailable =
      BigInt(balance.available_balance || 0) + amountNano;

    const newTotalDeposited =
      BigInt(balance.total_deposited || 0) + amountNano;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE deposits
         SET received_amount = ?,
             tx_hash = ?,
             status = 'completed',
             completed_at = ?
         WHERE id = ?`,
        [
          amountNano.toString(),
          txHash,
          now,
          deposit.id
        ]
      );

      await run(
        `INSERT INTO processed_txs
         (tx_hash, lt, type, processed_at)
         VALUES (?, ?, ?, ?)`,
        [
          txHash,
          match.lt ? String(match.lt) : null,
          'deposit',
          now
        ]
      );

      await run(
        `UPDATE balances
         SET available_balance = ?,
             total_deposited = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newAvailable.toString(),
          newTotalDeposited.toString(),
          now,
          deposit.user_id
        ]
      );

      await run(
        `INSERT INTO activity_logs
         (user_id, type, amount, meta, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          deposit.user_id,
          'deposit',
          amountNano.toString(),
          JSON.stringify({
            deposit_id: deposit.id,
            tx_hash: txHash,
            memo: deposit.memo,
            mode: 'tonapi'
          }),
          now
        ]
      );

      await run('COMMIT');
      processed += 1;
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
  }

  return {
    processed,
    scanned_transfers: transfers.length
  };
}

module.exports = {
  scanDepositsOnce
};
