function isEnabled(value) {
  return String(value || '0') === '1';
}

function isGlobalPaused() {
  return isEnabled(process.env.GLOBAL_PAUSE);
}

function isDepositPaused() {
  return isGlobalPaused() || isEnabled(process.env.DEPOSIT_PAUSE);
}

function isWithdrawPaused() {
  return isGlobalPaused() || isEnabled(process.env.WITHDRAW_PAUSE);
}

function isClaimPaused() {
  return isGlobalPaused() || isEnabled(process.env.CLAIM_PAUSE);
}

module.exports = {
  isGlobalPaused,
  isDepositPaused,
  isWithdrawPaused,
  isClaimPaused
};
