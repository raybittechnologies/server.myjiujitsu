const { protect } = require("../Controllers/authController");
const {
  createCourseTag,
  updateCourseTag,
} = require("../Controllers/courseTagsController");

const courseTagRouter = require("express").Router();

courseTagRouter.use(protect);
courseTagRouter.route("/").post(createCourseTag);
courseTagRouter.route("/:id").patch(updateCourseTag);

module.exports = courseTagRouter;
