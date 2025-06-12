const jwt = require("jsonwebtoken");
const { promisify } = require("util");

const { findOne } = require("../Controllers/handlerFactory");

exports.socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.query.token;
    if (!token) {
      const err = new Error("not authorized");
      err.data = { content: "Please login" };
      throw err;
    }

    const { email } = await promisify(jwt.verify)(
      token,
      process.env.JWT_SECRET
    );
    if (!email) throw new Error("Invalid Token");

    const [authUser] = await findOne("users", { email });

    socket.user = authUser;

    next();
  } catch (err) {
    socket.emit("error", "ERROR connection");
    next(err);
  }
};
