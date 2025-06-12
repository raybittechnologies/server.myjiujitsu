const {
  protect,
  successGoogleLogin,
} = require("../Controllers/authController");
const { getPastCompetitions, getUpcomingCompetitions, getFighterHistory } = require("../Controllers/expertController");
const upload = require("multer")();

const {
  updateUser,
  getAllUsers,
  getprofile,
  deleteUser,
  updateProfile,
  myLearning,
  profileCompletion,
  getOtherExperts,
  getOrderHistory,
  getCertificate,
  userWallet,
  purchasePoints,
  getCoinsPrchaseHistory,
  getCoinsCost,
  bookSeminar,
} = require("../Controllers/userController");
// const { uploadUserPhotos } = require("../Utils/uploadProfile");

const UserRouter = require("express").Router();

UserRouter.use(protect);
UserRouter.route("/").patch(updateUser).get(getAllUsers).delete(deleteUser);
UserRouter.route("/profile")
  .get(getprofile)
  .patch(
    upload.fields([{ name: "profile_picture", maxCount: 1 }]),
    updateProfile
  );
UserRouter.route("/otherExperts").get(getOtherExperts);
// UserRouter.route("/progress").post(updateVedioCpmpletion);
UserRouter.route("/profileCompletion").get(profileCompletion);
UserRouter.route("/myLearning").get(myLearning);
UserRouter.route("/getPastMatch").get(getPastCompetitions);
UserRouter.route("/getUpcomingMatch").get(getUpcomingCompetitions);
UserRouter.route("/getFighterHistory").get(getFighterHistory);
UserRouter.route("/orderHistory").get(getOrderHistory);
UserRouter.route("/certificates/:courseId").get(getCertificate);
UserRouter.route("/purchasePoints")
  .post(purchasePoints)
  .get(getCoinsPrchaseHistory);
UserRouter.route("/coinCost/:points").get(getCoinsCost);
UserRouter.route("/userWallet").get(userWallet);
UserRouter.route("/bookSeminar").post(bookSeminar);
module.exports = UserRouter;
