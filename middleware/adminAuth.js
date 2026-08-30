const { fail } = require('../utils/response');

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];

  if (!process.env.ADMIN_API_KEY) {
    return fail(res, 'ADMIN_KEY_NOT_CONFIGURED', 'Admin key is not configured', 500);
  }

  if (!key || key !== process.env.ADMIN_API_KEY) {
    return fail(res, 'ADMIN_FORBIDDEN', 'Invalid admin key', 403);
  }

  next();
}

module.exports = adminAuth;
