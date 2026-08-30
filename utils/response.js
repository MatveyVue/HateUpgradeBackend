function ok(res, data = {}) {
  return res.json({
    success: true,
    data
  });
}

function fail(res, code, message, status = 400) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message
    }
  });
}

module.exports = {
  ok,
  fail
};
