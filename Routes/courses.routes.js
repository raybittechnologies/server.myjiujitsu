const { protect, restrictTo } = require("../Controllers/authController");
const upload = require("multer")();
const {
  createCourse,
  updateCourse,
  getAllCourses,
  getCoursesOfExpert,
  getCourseById,
  getCourseOverview,
  getUserCourseOverview,
  getUserCourseOverviewWithoutPuchase,
  deleteCourse,
  videoStream,
  favouriteCourse,
} = require("../Controllers/coursesController");
const { uploadThumbnail } = require("../Utils/uploadProfile");

const coursesRouter = require("express").Router();

coursesRouter
  .route("/courseOverviewWithoutPurchase/:id")
  .get(getUserCourseOverviewWithoutPuchase);
coursesRouter.route("/userDashboard/courses").get(getAllCourses);

coursesRouter.use(protect);
coursesRouter.route("/expertCourses").get(getCoursesOfExpert);
coursesRouter
  .route("/")
  .post(upload.fields([{ name: "thumbnail", maxCount: 1 }]), createCourse);
coursesRouter
  .route("/:id")
  .patch(upload.fields([{ name: "thumbnail", maxCount: 1 }]), updateCourse)
  .get(getCourseById)
  .delete(deleteCourse);
coursesRouter.route("/courseOverview/:id").get(getCourseOverview);
// coursesRouter
//   .route("/courseOverviewWithoutPurchase/:id")
//   .get(getUserCourseOverviewWithoutPuchase);
coursesRouter.route("/usersCourseOverview/:id").get(getUserCourseOverview);
coursesRouter.route("/stream-video/:lessonId").get(videoStream);
coursesRouter.route("/favouriteCourse/:course_id").post(favouriteCourse);

module.exports = coursesRouter;
