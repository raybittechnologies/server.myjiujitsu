const { protect } = require("../Controllers/authController");
const {
  createChapter,
  updateChapter,
  getChaptersOfCourse,
  deleteChapter,
} = require("../Controllers/chapterController");

const chaptersRouter = require("express").Router();

chaptersRouter.use(protect);
chaptersRouter.route("/").post(createChapter).delete(deleteChapter)
chaptersRouter.route("/courseChapters/:course_id").get(getChaptersOfCourse);
chaptersRouter.route("/:id").patch(updateChapter);

module.exports = chaptersRouter;
