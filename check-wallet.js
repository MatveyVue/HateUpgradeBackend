require('dotenv').config();

const { mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV4 } = require('@ton/ton');

async function main() {
  const mnemonic = (process.env.PAYOUT_WALLET_MNEMONIC || '').trim().split(/\s+/);

  if (mnemonic.length !== 24) {
    console.log('ERROR: mnemonic must have 24 words');
    return;
  }

  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });

  console.log('PAYOUT WALLET ADDRESS:');
  console.log(wallet.address.toString({ bounceable: false }));
  console.log(wallet.address.toString({ bounceable: true }));
}

main().catch((e) => {
  console.error(e.message);
});
