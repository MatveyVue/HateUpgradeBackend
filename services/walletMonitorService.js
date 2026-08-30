const {
  TonClient,
  WalletContractV5R1
} = require('@ton/ton');

const { mnemonicToPrivateKey } = require('@ton/crypto');

async function checkHotWalletTonBalance() {
  if (!process.env.PAYOUT_WALLET_MNEMONIC) {
    return {
      ok: false,
      reason: 'PAYOUT_WALLET_MNEMONIC_NOT_CONFIGURED'
    };
  }

  const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_API_KEY
  });

  const mnemonic = process.env.PAYOUT_WALLET_MNEMONIC.trim().split(/\s+/);
  const keyPair = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });

  const walletContract = client.open(wallet);
  const balance = await walletContract.getBalance();

  const minNanoTon = BigInt(process.env.MIN_HOT_WALLET_TON_NANO || '100000000');

  return {
    ok: balance >= minNanoTon,
    wallet: wallet.address.toString(),
    balance_nano_ton: balance.toString(),
    min_required_nano_ton: minNanoTon.toString()
  };
}

module.exports = {
  checkHotWalletTonBalance
};
