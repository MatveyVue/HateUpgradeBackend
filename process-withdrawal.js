require('dotenv').config();

const sqlite3 = require('sqlite3').verbose();

const {
  TonClient,
  WalletContractV5R1,
  internal,
  toNano,
  Address,
  beginCell
} = require('@ton/ton');

const { mnemonicToPrivateKey } = require('@ton/crypto');

const db = new sqlite3.Database('./staking.db');

function getPendingWithdrawal() {
  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT *
        FROM withdrawals
        WHERE status = 'pending'
        AND deposit_id IS NOT NULL
        ORDER BY id ASC
        LIMIT 1
      `,
      [],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function markSent(id, txHash) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        UPDATE withdrawals
        SET status = 'sent',
            tx_hash = ?
        WHERE id = ?
      `,
      [txHash, id],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function main() {
  const withdrawal = await getPendingWithdrawal();

  if (!withdrawal) {
    console.log('NO PENDING WITHDRAWALS');
    return;
  }

  console.log('PENDING WITHDRAWAL FOUND:');
  console.log({
    id: withdrawal.id,
    wallet: withdrawal.wallet,
    amount: withdrawal.amount,
    deposit_id: withdrawal.deposit_id
  });

  if (process.env.PAYOUT_ENABLED !== 'true') {
    console.log('PAYOUT DISABLED. Set PAYOUT_ENABLED=true to send.');
    return;
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

  const jettonWalletAddress = Address.parse(
    '0:b322794b3438f4b60879e327969421f531395d16fa173900f6e7554236b2bf06'
  );

  const destination = Address.parse(withdrawal.wallet);

  const jettonAmount =
    BigInt(Math.floor(Number(withdrawal.amount) * 1_000_000_000));

  const body = beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(Date.now(), 64)
    .storeCoins(jettonAmount)
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

  const txHash = 'sent_seqno_' + seqno;

  await markSent(withdrawal.id, txHash);

  console.log('WITHDRAWAL SENT:');
  console.log({
    withdrawal_id: withdrawal.id,
    amount: withdrawal.amount,
    to: withdrawal.wallet,
    tx_hash: txHash
  });
}

main()
  .catch((e) => {
    console.error('ERROR:', e.message);
  })
  .finally(() => {
    db.close();
  });
