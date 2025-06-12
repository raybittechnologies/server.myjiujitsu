const { protect, restrictTo } = require("../Controllers/authController");
const { getRemarks } = require("../Controllers/coursesController");
const {
  getWalletDetails,
  expertDashboard,
  expertGraphs,
  getWithdrawalHistory,
  createReviewRequest,
  getProfile,
  addPastCompetition,
  getPastCompetitions,
  addUpcomingCompetition,
  getUpcomingCompetitions,
  addFigherHistory,
  updateFighterHistory,
  deleteFighterHistory,
  updatePastCompetition,
  deletePastCompetition,
  updateUpcomingCompetition,
  deleteUpcomingCompetition,
  getSeminarBookings,
} = require("../Controllers/expertController");

const expertRouter = require("express").Router();

expertRouter.route("/profile/:id").get(getProfile);
expertRouter.use(protect, restrictTo(["expert"]));
expertRouter.route("/expertWallet").get(getWalletDetails);
expertRouter.route("/expertDashboard").get(expertDashboard);
expertRouter.route("/expertGraphs").get(expertGraphs);
expertRouter.route("/withdrawalHistory").get(getWithdrawalHistory);
expertRouter.route("/reviewRequest").post(createReviewRequest);
expertRouter.route("/getRemarks/:course_id").get(getRemarks);
expertRouter.route("/addFighterHistory").post(addFigherHistory);
expertRouter.route("/updateFighterHistory/:id").patch(updateFighterHistory);
expertRouter.route("/deleteFighterHistory/:id").delete(deleteFighterHistory);
expertRouter.route("/addPastMatch").post(addPastCompetition);
expertRouter.route("/updatePastMatch/:id").patch(updatePastCompetition);
expertRouter.route("/deletePastMatch/:id").delete(deletePastCompetition);
expertRouter.route("/addUpcomingMatch").post(addUpcomingCompetition);
expertRouter.route("/updateUpcomingMatch/:id").patch(updateUpcomingCompetition);
expertRouter.route("/deleteUpcomingMatch/:id").delete(deleteUpcomingCompetition);
expertRouter.route("/getSeminarBookings").get(getSeminarBookings);


module.exports = expertRouter;
