const { protect } = require("../Controllers/authController");
const upload = require("multer")();
const {
  createLesson,
  getAllLessons,
  getLessonsOfChapter,
  changeLessonSequence,
  updateLesson,
  deleteLesson,
  markLessonAsRead,
} = require("../Controllers/lessonsController");

const lessonsRouter = require("express").Router();

lessonsRouter.use(protect);
lessonsRouter
  .route("/")
  .post(
    upload.fields([
      { name: "thumbnail", maxCount: 1 },
      { name: "video_url", maxCount: 1 },
    ]),
    createLesson
  )
  .get(getAllLessons);
lessonsRouter.route("/changeSeq").patch(changeLessonSequence);
lessonsRouter.route("/markLessonAsRead").patch(markLessonAsRead);
lessonsRouter
  .route("/:id")
  .get(getLessonsOfChapter)
  .patch(upload.fields([{ name: "thumbnail", maxCount: 1 }]), updateLesson)
  .delete(deleteLesson);

module.exports = lessonsRouter;
