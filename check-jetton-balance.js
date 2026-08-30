require('dotenv').config();

async function main() {
  const address = process.env.STAKING_WALLET;

  const url =
    'https://tonapi.io/v2/accounts/' +
    encodeURIComponent(address) +
    '/jettons';

  const res = await fetch(url);

  if (!res.ok) {
    console.log('ERROR:', res.status, await res.text());
    return;
  }

  const data = await res.json();

  const balances = data.balances || [];

  const scmd = balances.find((b) => {
    const raw = JSON.stringify(b);
    return raw.includes(process.env.SCMD69_JETTON_RAW) ||
           raw.includes(process.env.SCMD69_JETTON_MASTER) ||
           raw.includes('SCMD69');
  });

  if (!scmd) {
    console.log('SCMD69 BALANCE NOT FOUND');
    return;
  }

  const decimals = Number(scmd.jetton.decimals || 9);
  const balance = Number(scmd.balance) / Math.pow(10, decimals);

  console.log('SCMD69 BALANCE:');
  console.log(balance);
  console.log('');
  console.log('JETTON WALLET:');
  console.log(scmd.wallet_address.address);
}

main().catch((e) => {
  console.error(e.message);
});
