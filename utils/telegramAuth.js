const crypto = require('crypto');

function validateTelegramInitData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN_NOT_CONFIGURED');
  }

  if (!initData || typeof initData !== 'string') {
    throw new Error('INIT_DATA_REQUIRED');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new Error('HASH_MISSING');
  }

  params.delete('hash');

  const dataCheckString = Array
    .from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    throw new Error('INVALID_INIT_DATA_HASH');
  }

  const authDate = Number(params.get('auth_date') || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!authDate || nowSeconds - authDate > 86400) {
    throw new Error('INIT_DATA_EXPIRED');
  }

  const userRaw = params.get('user');

  if (!userRaw) {
    throw new Error('USER_MISSING');
  }

  const user = JSON.parse(userRaw);

  return {
    telegram_id: String(user.id),
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null
  };
}

module.exports = {
  validateTelegramInitData
};
