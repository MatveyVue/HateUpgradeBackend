require('dotenv').config();

async function main() {
  const address = process.env.STAKING_WALLET;

  const url =
    'https://tonapi.io/v2/accounts/' +
    encodeURIComponent(address);

  const res = await fetch(url);

  if (!res.ok) {
    console.log('ERROR:', res.status, await res.text());
    return;
  }

  const data = await res.json();

  const balanceNano = Number(data.balance || 0);
  const balanceTon = balanceNano / 1_000_000_000;

  console.log('STAKING WALLET:');
  console.log(address);
  console.log('');
  console.log('TON BALANCE:');
  console.log(balanceTon);
}

main().catch((e) => {
  console.error(e.message);
});
