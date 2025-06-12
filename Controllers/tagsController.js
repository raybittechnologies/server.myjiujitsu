const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { create, findAndUpdate } = require("./handlerFactory");

exports.createTag = asyncChoke(async (req, res, next) => {
  const { name } = req.body;

  if (!name) return next(new AppError(401, "provide all inputs"));

  const result = await create("tags", { name });

  res.status(200).json({
    message: "Success",
    tag_id: result.insertId,
  });
});

exports.updateTag = asyncChoke(async (req, res, next) => {
  const { name } = req.body;
  const { id } = req.params;

  if (!name) return next(new AppError(401, "nothing to be updated"));

  await findAndUpdate("tags", { name }, { id });

  res.status(200).json({
    message: "Success",
    message: "Tag updated successfully",
  });
});

exports.getAllTags = asyncChoke(async (req, res, next) => {
  let { search } = req.query;
  if (!search) search = ``;

  const query = `select * from tags where name like ?`;
  const [result] = await pool.query(query, [`%${search}%`]);

  res.status(200).json({
    status: "Success",
    data: result,
  });
});
