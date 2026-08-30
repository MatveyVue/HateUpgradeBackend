const { fail } = require('../utils/response');

function devAuth(req, res, next) {
  const telegramId = req.headers['x-telegram-id'];

  if (!telegramId) {
    return fail(res, 'AUTH_REQUIRED', 'Missing x-telegram-id header', 401);
  }

  req.user = {
    telegram_id: String(telegramId),
    username: req.headers['x-username'] || null,
    first_name: req.headers['x-first-name'] || null,
    last_name: req.headers['x-last-name'] || null
  };

  next();
}

module.exports = devAuth;
