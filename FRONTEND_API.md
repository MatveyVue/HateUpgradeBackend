# SCMD69 Staking Backend API

Base URL local:
http://localhost:3000

Auth сейчас временный для теста:
Header:
x-telegram-id: USER_TELEGRAM_ID

Позже заменим на Telegram Mini App initData.

---

## Health

GET /health

---

## Profile

GET /profile

Возвращает:
- user
- available_balance
- active_stake
- claimable_rewards
- locked_withdraw_balance
- current season

---

## Profile Activity

GET /profile/activity

История:
- deposit
- stake
- restake
- unstake
- penalty
- reward_accrued
- claim
- withdraw

---

## Staking Info

GET /staking/info

Данные для staking экрана:
- active_stake
- claimable_rewards
- available_balance
- can_stake
- can_restake
- can_unstake
- can_claim
- season APY
- days_left
- min_stake
- penalty

---

## Stake

POST /staking/stake

Body:
{
  "amount": "500000000000000"
}

Минимум:
500,000 SCMD69

---

## Restake

POST /staking/restake

Body:
{
  "amount": "500000000000000"
}

---

## Unstake

POST /staking/unstake

Body:
{
  "amount": "1000000000000000"
}

Если сезон активен:
- 20% penalty
- 80% возвращается в available_balance

Если сезон окончен:
- 100% возвращается в available_balance

---

## Claim

POST /staking/claim

Переносит:
claimable_rewards -> available_balance

Blockchain transfer не делает.

---

## Deposit Create

POST /deposit/create

Возвращает:
- deposit_id
- wallet
- jetton_master
- memo
- status

Пользователь должен отправить SCMD69 на wallet с memo.

---

## Deposit History

GET /deposit/history

---

## Withdraw Create

POST /withdraw/create

Body:
{
  "amount": "1000000000000000",
  "address": "UQ..."
}

Минимум:
1,000,000 SCMD69

Сумма уходит в locked_withdraw_balance до обработки.

---

## Withdraw History

GET /withdraw/history

---

# Amount format

Все amount backend принимает и отдаёт в nano SCMD69.

1 SCMD69 = 1000000000

Примеры:
500,000 SCMD69 = 500000000000000
1,000,000 SCMD69 = 1000000000000000
2,000,000 SCMD69 = 2000000000000000

---

# Error format

{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Text"
  }
}

---

# Main error codes

AUTH_REQUIRED
INVALID_AMOUNT
INSUFFICIENT_BALANCE
INSUFFICIENT_STAKE
MIN_STAKE_NOT_REACHED
MIN_WITHDRAW_NOT_REACHED
SEASON_CLOSED
NOTHING_TO_CLAIM
INVALID_ADDRESS
WITHDRAW_IN_PROGRESS

---

# Telegram Mini App Auth

Теперь backend поддерживает Telegram Mini App auth.

Временный header:
x-telegram-id

оставлен только для локальных тестов.

Production auth:

POST /auth/telegram

Body:
{
  "initData": "Telegram.WebApp.initData"
}

Frontend должен получить:

window.Telegram.WebApp.initData

После auth backend возвращает:

{
  "success": true,
  "data": {
    "token": "JWT_TOKEN",
    "user": {
      "id": 1,
      "telegram_id": "777"
    }
  }
}

Позже frontend будет использовать:

Authorization: Bearer JWT_TOKEN

для всех запросов.

