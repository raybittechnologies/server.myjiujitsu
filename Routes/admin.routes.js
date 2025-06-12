const {
  adminDashboard,
  dashboardGraphs,
  expertsForAdmin,
  usersForAdmin,
  payExpertList,
  adminPaidHistory,
  getCommissionRate,
  updateCommision,
  userById,
  getPayoutRequest,
  suspendUser,
  notificationRead,
  approveCourse,
  getApproveRequests,
  addExpert,
} = require("../Controllers/adminController");
const { protect, restrictTo } = require("../Controllers/authController");

const adminRouter = require("express").Router();

adminRouter.use(protect, restrictTo(["admin"]));
adminRouter.route("/adminDashboard").get(adminDashboard);
adminRouter.route("/adminDashboardGraphs").get(dashboardGraphs);
adminRouter.route("/expertsForAdmin").get(expertsForAdmin).post(addExpert);
adminRouter.route("/usersForAdmin").get(usersForAdmin);
// adminRouter.route("/usersForAdmin/:id").get(userById);
// adminRouter.route("/payExpertsList").get(payExpertList);
adminRouter.route("/adminPayHistory").get(adminPaidHistory);
adminRouter.route("/commission").get(getCommissionRate);
adminRouter.route("/commission/:id").patch(updateCommision);
adminRouter.route("/payoutRequest").get(getPayoutRequest);
adminRouter.route("/suspenduser/:id").patch(suspendUser);
adminRouter.route("/approveCourse").get(getApproveRequests);
adminRouter.route("/approveCourse/:id").patch(approveCourse);

// adminRouter.route("/readNotification/").patch(notificationRead);

module.exports = adminRouter;
