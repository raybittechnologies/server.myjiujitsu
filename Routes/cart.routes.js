const { protect, restrictTo } = require("../Controllers/authController");
const {
  createCart,
  getCart,
  removeCart,
} = require("../Controllers/cartController");

const cartRouter = require("express").Router();

cartRouter.use(protect, restrictTo(["user"]));
cartRouter.route("/").post(createCart).get(getCart);
cartRouter.route("/:id").delete(removeCart);

module.exports = cartRouter;
