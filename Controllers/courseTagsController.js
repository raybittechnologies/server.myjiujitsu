const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { create, findAndUpdate } = require("./handlerFactory");

exports.createCourseTag = asyncChoke(async (req, res, next) => {
  const { course_id, tag_id } = req.body;

  const query = `select * from course_tags where course_id=? AND tag_id=?`;
  const [results] = await pool.query(query, [course_id, tag_id]);

  if (results.length) {
    return next(new AppError(401, "course with this tag already exists"));
  }

  if (!course_id || !tag_id)
    return next(new AppError(401, "provide all inputs"));

  await create("course_tags", { course_id, tag_id });

  res.status(200).json({
    message: "Success",
    message: " course Tag created successfully",
  });
});

exports.updateCourseTag = asyncChoke(async (req, res, next) => {
  const { course_id, tag_id } = req.body;
  const { id } = req.params;

  const query = `select * from course_tags where course_id=? AND tag_id=?`;
  const [results] = await pool.query(query, [course_id, tag_id]);

  if (results.length) {
    return next(new AppError(401, "course with this tag already exists"));
  }

  const updatedCourse = await findAndUpdate(
    "course_tags",
    { course_id, tag_id },
    { id }
  );

  if (updatedCourse[0].affectedRows === 0)
    return next(new AppError(401, "no course found with this tag "));

  res.status(200).json({
    message: "Success",
    message: "course tag updated successfully",
  });
});
