require('dotenv').config();

const {
  TonClient,
  WalletContractV5R1,
  internal,
  toNano,
  Address,
  beginCell
} = require('@ton/ton');

const { mnemonicToPrivateKey } = require('@ton/crypto');

async function main() {

  const mnemonic =
    process.env.PAYOUT_WALLET_MNEMONIC
      .trim()
      .split(/\s+/);

  const keyPair =
    await mnemonicToPrivateKey(mnemonic);

  const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.TONCENTER_API_KEY
});;

  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });

  const walletContract =
    client.open(wallet);

  const seqno =
    await walletContract.getSeqno();

  console.log('WALLET:', wallet.address.toString());
  console.log('SEQNO:', seqno);

  const jettonWalletAddress =
    Address.parse(
      '0:b322794b3438f4b60879e327969421f531395d16fa173900f6e7554236b2bf06'
    );

  const destination =
    Address.parse(
      'UQANL5knevs_Otz-fDUD0HtOAtWvylZreOJ_wXXjBoXL2uTm'
    );

  const jettonAmount =
    BigInt(1_000_000_000);

  const body = beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(0, 64)
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

  console.log('TEST SCMD69 TRANSFER SENT');
}

main().catch((e) => {
  console.error(e);
});
