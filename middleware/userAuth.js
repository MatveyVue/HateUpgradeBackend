const jwt = require('jsonwebtoken');

const { fail } = require('../utils/response');
const { get } = require('../database/db');

async function userAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (token) {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || 'change_me_super_secret'
      );

      const user = await get(
        `SELECT * FROM users WHERE id = ? AND telegram_id = ?`,
        [payload.user_id, String(payload.telegram_id)]
      );

      if (!user) {
        return fail(res, 'USER_NOT_FOUND', 'User not found', 401);
      }

      req.user = {
        telegram_id: String(user.telegram_id),
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      };

      return next();
    }

    if (String(process.env.ALLOW_DEV_AUTH || '0') === '1') {
      const telegramId = req.headers['x-telegram-id'];

      if (!telegramId) {
        return fail(res, 'AUTH_REQUIRED', 'Missing auth token or x-telegram-id', 401);
      }

      req.user = {
        telegram_id: String(telegramId),
        username: req.headers['x-username'] || null,
        first_name: req.headers['x-first-name'] || null,
        last_name: req.headers['x-last-name'] || null
      };

      return next();
    }

    return fail(res, 'AUTH_REQUIRED', 'Authorization token required', 401);
  } catch (err) {
    return fail(res, 'INVALID_AUTH_TOKEN', err.message, 401);
  }
}

module.exports = userAuth;
