const { protect } = require("../Controllers/authController");
const {
  createReview,
  readAllReviews,
  updateReview,
  deleteReview,
  getOverallRating,
  getUserRating,
} = require("../Controllers/reviewController");

const ReviewRouter = require("express").Router();

ReviewRouter.use(protect);

ReviewRouter.route("/").post(createReview).get(readAllReviews);
ReviewRouter.route("/:id")
  .get(getUserRating)
  .patch(updateReview)
  .delete(deleteReview);

ReviewRouter.route("/totalReview/:course_id").get(getOverallRating);

module.exports = ReviewRouter;
