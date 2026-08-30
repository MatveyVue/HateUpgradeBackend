# SCMD69 STAKING COMMANDS

---

# START BACKEND

cd ~/scmd69-staking
node index.js

---

# STOP BACKEND

CTRL + C

---

# CHECK FILE SYNTAX

node --check index.js

Проверка конкретного файла:

node --check routes/staking.js

---

# PROFILE

curl -s \
  -H "x-telegram-id: 777" \
  http://localhost:3000/profile | python3 -m json.tool

---

# STAKING INFO

curl -s \
  -H "x-telegram-id: 777" \
  http://localhost:3000/staking/info | python3 -m json.tool

---

# ACTIVITY

curl -s \
  -H "x-telegram-id: 777" \
  http://localhost:3000/profile/activity | python3 -m json.tool

---

# STAKE

curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-telegram-id: 777" \
  -d '{"amount":"500000000000000"}' \
  http://localhost:3000/staking/stake | python3 -m json.tool

---

# RESTAKE

curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-telegram-id: 777" \
  -d '{"amount":"500000000000000"}' \
  http://localhost:3000/staking/restake | python3 -m json.tool

---

# UNSTAKE

curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-telegram-id: 777" \
  -d '{"amount":"1000000000000000"}' \
  http://localhost:3000/staking/unstake | python3 -m json.tool

---

# CLAIM

curl -s -X POST \
  -H "x-telegram-id: 777" \
  http://localhost:3000/staking/claim | python3 -m json.tool

---

# CREATE DEPOSIT

curl -s -X POST \
  -H "x-telegram-id: 777" \
  http://localhost:3000/deposit/create | python3 -m json.tool

---

# DEPOSIT HISTORY

curl -s \
  -H "x-telegram-id: 777" \
  http://localhost:3000/deposit/history | python3 -m json.tool

---

# CREATE WITHDRAW

curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "x-telegram-id: 777" \
  -d '{"amount":"1000000000000000","address":"UQ..."}' \
  http://localhost:3000/withdraw/create | python3 -m json.tool

---

# WITHDRAW HISTORY

curl -s \
  -H "x-telegram-id: 777" \
  http://localhost:3000/withdraw/history | python3 -m json.tool

---

# ADMIN STATS

curl -s \
  -H "x-admin-key: change_me_admin_key_69" \
  http://localhost:3000/admin/stats | python3 -m json.tool

---

# START SEASON

curl -s -X POST \
  -H "x-admin-key: change_me_admin_key_69" \
  http://localhost:3000/admin/start-season | python3 -m json.tool

---

# PAUSE SEASON

curl -s -X POST \
  -H "x-admin-key: change_me_admin_key_69" \
  http://localhost:3000/admin/pause-season | python3 -m json.tool

---

# RESUME SEASON

curl -s -X POST \
  -H "x-admin-key: change_me_admin_key_69" \
  http://localhost:3000/admin/resume-season | python3 -m json.tool

---

# ACCRUE REWARDS MANUAL

curl -s -X POST \
  -H "x-admin-key: change_me_admin_key_69" \
  http://localhost:3000/admin/accrue-rewards | python3 -m json.tool

---

# SCAN DEPOSITS

curl -s -X POST \
  -H "x-admin-key: change_me_admin_key_69" \
  http://localhost:3000/admin/scan-deposits-once | python3 -m json.tool

---

# PROCESS MOCK WITHDRAWALS

curl -s -X POST \
  -H "x-admin-key: change_me_admin_key_69" \
  http://localhost:3000/admin/process-withdrawals-mock | python3 -m json.tool

---

# BACKUP DATABASE

./scripts/backup-db.sh

---

# LIST BACKUPS

ls -lah backups

