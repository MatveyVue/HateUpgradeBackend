const { get, all, run } = require('../database/db');

const {
  TonClient,
  WalletContractV5R1,
  internal,
  toNano,
  Address,
  beginCell
} = require('@ton/ton');

const { mnemonicToPrivateKey } = require('@ton/crypto');

const SCMD69_JETTON_WALLET_ADDRESS =
  '0:4051da542b47448dcab7aea141cfc9d4ef924eb91c72c661057028a81d963168';

async function sendJettonReal(toAddress, amountNano) {
  if (!process.env.PAYOUT_WALLET_MNEMONIC) {
    throw new Error('PAYOUT_WALLET_MNEMONIC_NOT_CONFIGURED');
  }

  const mnemonic = process.env.PAYOUT_WALLET_MNEMONIC.trim().split(/\s+/);
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_API_KEY
  });

  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });

  const walletContract = client.open(wallet);
  const seqno = await walletContract.getSeqno();

  const jettonWalletAddress = Address.parse(SCMD69_JETTON_WALLET_ADDRESS);
  const destination = Address.parse(toAddress);

  const body = beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(Date.now(), 64)
    .storeCoins(BigInt(amountNano))
    .storeAddress(destination)
    .storeAddress(wallet.address)
    .storeBit(0)
    .storeCoins(toNano('0.05'))
    .storeBit(0)
    .endCell();

  await walletContract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: jettonWalletAddress,
        value: toNano('0.1'),
        body
      })
    ]
  });

  return {
    tx_hash: `sent_seqno_${seqno}`,
    seqno,
    from_wallet: wallet.address.toString()
  };
}

async function processPendingWithdrawalsMock() {
  const now = Date.now();

  const rows = await all(
    `SELECT * FROM withdrawals
     WHERE status = 'pending'
     ORDER BY id ASC
     LIMIT 5`
  );

  let processed = 0;

  for (const w of rows) {
    const balance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [w.user_id]
    );

    const amount = BigInt(w.amount);
    const locked = BigInt(balance.locked_withdraw_balance || 0);

    if (locked < amount) {
      await run(
        `UPDATE withdrawals
         SET status = 'failed',
             error = ?,
             processed_at = ?
         WHERE id = ?`,
        ['LOCKED_BALANCE_TOO_LOW', now, w.id]
      );
      continue;
    }

    const newLocked = locked - amount;
    const newTotalWithdrawn = BigInt(balance.total_withdrawn || 0) + amount;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE withdrawals
         SET status = 'completed',
             tx_hash = ?,
             processed_at = ?
         WHERE id = ?`,
        [
          `mock_tx_${w.id}_${now}`,
          now,
          w.id
        ]
      );

      await run(
        `UPDATE balances
         SET locked_withdraw_balance = ?,
             total_withdrawn = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newLocked.toString(),
          newTotalWithdrawn.toString(),
          now,
          w.user_id
        ]
      );

      await run(
        `INSERT INTO activity_logs
         (user_id, type, amount, meta, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          w.user_id,
          'withdraw_completed',
          amount.toString(),
          JSON.stringify({
            withdrawal_id: w.id,
            tx_hash: `mock_tx_${w.id}_${now}`,
            mode: 'mock'
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

  return { processed };
}

async function processOnePendingWithdrawalReal() {
  const now = Date.now();

  const w = await get(
    `SELECT * FROM withdrawals
     WHERE status = 'pending'
     ORDER BY id ASC
     LIMIT 1`
  );

  if (!w) {
    return {
      processed: 0,
      reason: 'NO_PENDING_WITHDRAWALS'
    };
  }

  const balance = await get(
    `SELECT * FROM balances WHERE user_id = ?`,
    [w.user_id]
  );

  const amount = BigInt(w.amount);
  const locked = BigInt(balance.locked_withdraw_balance || 0);

  if (locked < amount) {
    await run(
      `UPDATE withdrawals
       SET status = 'failed',
           error = ?,
           processed_at = ?
       WHERE id = ?`,
      ['LOCKED_BALANCE_TOO_LOW', now, w.id]
    );

    return {
      processed: 0,
      failed: 1,
      reason: 'LOCKED_BALANCE_TOO_LOW',
      withdrawal_id: w.id
    };
  }

  await run(
    `UPDATE withdrawals
     SET status = 'processing'
     WHERE id = ?`,
    [w.id]
  );

  try {
    const sent = await sendJettonReal(w.to_address, w.amount);

    const doneAt = Date.now();
    const newLocked = locked - amount;
    const newTotalWithdrawn = BigInt(balance.total_withdrawn || 0) + amount;

    await run('BEGIN TRANSACTION');

    try {
      await run(
        `UPDATE withdrawals
         SET status = 'sent',
             tx_hash = ?,
             processed_at = ?
         WHERE id = ?`,
        [
          sent.tx_hash,
          doneAt,
          w.id
        ]
      );

      await run(
        `UPDATE balances
         SET locked_withdraw_balance = ?,
             total_withdrawn = ?,
             updated_at = ?
         WHERE user_id = ?`,
        [
          newLocked.toString(),
          newTotalWithdrawn.toString(),
          doneAt,
          w.user_id
        ]
      );

      await run(
        `INSERT INTO activity_logs
         (user_id, type, amount, meta, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          w.user_id,
          'withdraw_sent',
          amount.toString(),
          JSON.stringify({
            withdrawal_id: w.id,
            tx_hash: sent.tx_hash,
            seqno: sent.seqno,
            from_wallet: sent.from_wallet,
            to_address: w.to_address,
            mode: 'real_waiting_confirmation'
          }),
          doneAt
        ]
      );

      await run('COMMIT');

      return {
        processed: 1,
        withdrawal_id: w.id,
        tx_hash: sent.tx_hash,
        seqno: sent.seqno,
        amount: amount.toString(),
        to_address: w.to_address
      };
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
  } catch (err) {
    const message = err.response?.data?.error || err.response?.data?.result || err.message || String(err);

    await run(
      `UPDATE withdrawals
       SET status = 'failed',
           error = ?,
           processed_at = ?
       WHERE id = ?`,
      [
        String(message).slice(0, 500),
        Date.now(),
        w.id
      ]
    );

    const currentBalance = await get(
      `SELECT * FROM balances WHERE user_id = ?`,
      [w.user_id]
    );

    await run(
      `UPDATE balances
       SET available_balance = ?,
           locked_withdraw_balance = ?,
           updated_at = ?
       WHERE user_id = ?`,
      [
        (BigInt(currentBalance.available_balance || 0) + amount).toString(),
        (BigInt(currentBalance.locked_withdraw_balance || 0) - amount).toString(),
        Date.now(),
        w.user_id
      ]
    );

    return {
      processed: 0,
      failed: 1,
      withdrawal_id: w.id,
      error: String(message).slice(0, 500)
    };
  }
}

module.exports = {
  processPendingWithdrawalsMock,
  processOnePendingWithdrawalReal,
  sendJettonReal
};
