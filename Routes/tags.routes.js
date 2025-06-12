const { protect } = require("../Controllers/authController");
const {
  createTag,
  updateTag,
  getAllTags,
} = require("../Controllers/tagsController");

const TagsRouter = require("express").Router();

TagsRouter.use(protect);
TagsRouter.route("/").post(createTag).get(getAllTags);
TagsRouter.route("/:id").patch(updateTag);

module.exports = TagsRouter;
