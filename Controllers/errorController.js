const sendResponse = (res, message, resCode = 400, err) => {
  res.status(resCode).json({
    message,
    err,
  });
};

exports.sendError = async (err, req, res, next) => {
  sendResponse(res, err.message, err.statusCode, err.stack);
};
