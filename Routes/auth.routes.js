const passport = require("passport");
require("../Utils/passport_setup");

const {
  signUp,
  login,
  verifyEmail,
  getVerificationToken,
  protect,
  logout,
  isLoggedIn,
  forgotPassword,
  resetPassword,
  updatePassword,
  addUser,
  restrictTo,
  successGoogleLogin,
  failureGoogleLogin,
  authenticateGoogle,
  getEmail,
  changeEmail,
  EmailUpdateVerification,
  deleteAccount,
} = require("../Controllers/authController");
const { uploadUserPhotos } = require("../Utils/uploadProfile");

const AuthRouter = require("express").Router();
AuthRouter.use(passport.initialize());
AuthRouter.use(passport.session());

AuthRouter.route("/google").get(
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
  })
);
AuthRouter.route("/google/callback").get(
  passport.authenticate("google", {
    successRedirect: "/api/v1/auth/success",
    failureRedirect: "/api/v1/auth/failure",
  })
);

AuthRouter.route("/success").get(successGoogleLogin);
AuthRouter.route("/failure").get(failureGoogleLogin);

AuthRouter.post("/login", login);
AuthRouter.post("/isLoggedIn", isLoggedIn);
AuthRouter.post("/forgot-password", forgotPassword);
AuthRouter.post("/reset-password/:token", resetPassword);
AuthRouter.post("/signup", addUser);
AuthRouter.get("/:token", verifyEmail);
AuthRouter.route("/email/updateEmail/:token").get(EmailUpdateVerification);
AuthRouter.post("/email/verifyEmail", getVerificationToken);

// AuthRouter.use(restrictTo(["expert", "admin"]));
AuthRouter.use(protect);
AuthRouter.post("/logout", logout);
AuthRouter.route("/updatePassword").patch(updatePassword);
AuthRouter.route("/email/updateEmail").patch(changeEmail);
AuthRouter.patch("/deleteAccount", deleteAccount);

module.exports = AuthRouter;
