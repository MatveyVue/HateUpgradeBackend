require('dotenv').config();

const { mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV5R1 } = require('@ton/ton');

async function main() {
  const mnemonic = (process.env.PAYOUT_WALLET_MNEMONIC || '').trim().split(/\s+/);

  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });

  console.log('EXPECTED:');
  console.log(process.env.STAKING_WALLET);
  console.log('');

  console.log('V5 non-bounceable:');
  console.log(wallet.address.toString({ bounceable: false }));

  console.log('V5 bounceable:');
  console.log(wallet.address.toString({ bounceable: true }));
}

main().catch((e) => {
  console.error(e.message);
});
