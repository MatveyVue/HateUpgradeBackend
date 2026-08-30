# SCMD69 Staking Backend

## Config

GET /config

Returns staking settings:
- jetton master
- staking wallet
- min deposit
- APY
- lock days
- early withdraw penalty

## Create Deposit Order

POST /deposit-order

Body:
{
  "wallet": "USER_TON_WALLET",
  "amount": 2000000
}

Response:
{
  "order_id": 1,
  "send_to": "STAKING_WALLET",
  "comment": "STAKE-..."
}

User must send SCMD69 to `send_to` with exact `comment`.

## User Position

GET /position/:wallet

Returns active deposits and earned rewards.

## Withdraw

POST /withdraw

Body:
{
  "wallet": "USER_TON_WALLET",
  "deposit_id": 1
}

Logic:
- after 60 days: deposit + earned
- before 60 days: deposit + earned - 20% penalty

Creates pending payout.

## Admin Orders

GET /admin/orders

Header:
x-admin-key: ADMIN_KEY

## Admin Withdrawals

GET /admin/withdrawals

Header:
x-admin-key: ADMIN_KEY

## Auto Systems

Backend automatically:
- scans pending deposit orders every 30 seconds
- checks TON blockchain
- activates paid deposits
- scans pending withdrawals every 60 seconds
- sends SCMD69 payouts if PAYOUT_ENABLED=true

## Important

Do not expose:
- PAYOUT_WALLET_MNEMONIC
- TONCENTER_API_KEY
- ADMIN_KEY
