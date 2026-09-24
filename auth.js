const express = require('express');
const jwt = require('jsonwebtoken');

const { ok, fail } = require('../utils/response');
const { validateTelegramInitData } = require('../utils/telegramAuth');
const { getOrCreateUser } = require('../services/userService');

const router = express.Router();

router.post('/telegram', async (req, res) => {
  try {
    const { initData } = req.body;

    let profile;

    if (!initData || initData.trim() === '') {
      profile = {
        telegram_id: '2002',
        id: '2002',
        username: 'scmd69_dev',
        first_name: 'SCMD69',
        last_name: 'DEV'
      };

      console.log('DEV AUTH ENABLED');
    } else {
      profile = validateTelegramInitData(initData);
    }

    const user = await getOrCreateUser(profile);

    const token = jwt.sign(
      {
        user_id: user.id,
        telegram_id: user.telegram_id
      },
      process.env.JWT_SECRET || 'change_me_super_secret',
      { expiresIn: '7d' }
    );

    return ok(res, {
      token,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      }
    });
  } catch (err) {
    return fail(res, 'INVALID_TELEGRAM_AUTH', err.message, 401);
  }
});

module.exports = router;
