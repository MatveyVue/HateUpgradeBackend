const { fail } = require('../utils/response');
const { validateTelegramInitData } = require('../utils/telegramAuth');

function telegramAuth(req, res, next) {
  try {
    const initData =
      req.headers['x-telegram-init-data'] ||
      req.body?.initData;

    req.user = validateTelegramInitData(initData);

    next();
  } catch (err) {
    return fail(res, 'INVALID_TELEGRAM_AUTH', err.message, 401);
  }
}

module.exports = telegramAuth;
