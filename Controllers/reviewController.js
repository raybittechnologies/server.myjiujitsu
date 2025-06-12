const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const {
  findMany,
  findAndUpdate,
  findOne,
  findAndDelete,
  create,
} = require("./handlerFactory");

exports.calculateRating = async (course_id) => {
  const query = `
    SELECT name, rating, comment, review_date, profile_picture
    FROM reviews
    JOIN users ON reviews.user_id = users.id
    WHERE reviews.course_id = ?
  `;

  const [rows] = await pool.query(query, [course_id]);

  // if (rows.length === 0) return next(new AppError(404, "No rating found"));

  const totalRatings = rows.reduce((acc, row) => acc + row.rating, 0);
  const averageRating = rows.length
    ? (totalRatings / rows.length).toFixed(2)
    : 0;

  const ratingCounts = rows.reduce((acc, row) => {
    acc[row.rating] = (acc[row.rating] || 0) + 1;
    return acc;
  }, {});

  const totalReviews = rows.length;
  const ratingPercentages = {
    1: totalReviews > 0 ? ((ratingCounts[1] || 0) / totalReviews) * 100 : 0,
    2: totalReviews > 0 ? ((ratingCounts[2] || 0) / totalReviews) * 100 : 0,
    3: totalReviews > 0 ? ((ratingCounts[3] || 0) / totalReviews) * 100 : 0,
    4: totalReviews > 0 ? ((ratingCounts[4] || 0) / totalReviews) * 100 : 0,
    5: totalReviews > 0 ? ((ratingCounts[5] || 0) / totalReviews) * 100 : 0,
  };

  const data = {
    rows,
    ratingPercentages,
    averageRating,
    totalReviews,
  };
  return data;
};

const sendResponse = (res, statusCode, data) => {
  res.status(statusCode).json({
    status: "Success",
    data,
  });
};

exports.createReview = asyncChoke(async (req, res, next) => {
  const { courseId: course_id, rating, comment } = req.body;

  if (!course_id || !rating || !comment)
    return next(new AppError(402, "Provide all the required fields"));

  if (rating < 0 || rating > 5)
    return next(new AppError(402, "Rating can only be from 0-5"));

  const results = await create("reviews", {
    course_id,
    rating,
    review_date: new Date(Date.now()),
    comment,
    user_id: req.user.id,
  });

  sendResponse(res, 200, { message: "Review created successfully" });
});

exports.readAllReviews = asyncChoke(async (req, res, next) => {
  const { courseId: course_id } = req.body;

  const query = `select name,rating,comment,review_date,profile_picture
   from reviews join users on reviews.user_id=users.id 
   where reviews.course_id=?`;

  const [result] = await pool.query(query, [course_id]);

  sendResponse(res, 200, { message: "Fetched all the reviwes", result });
});

exports.getOverallRating = asyncChoke(async (req, res, next) => {
  const { course_id } = req.params;

  const course = await findOne("courses", { id: course_id });
  if (course.length === 0) return next(new AppError(404, "no course found"));

  const data = await this.calculateRating(course_id, next);
  if (!data) return next(new AppError(404, "no rating found"));

  sendResponse(res, 200, {
    status: "success",
    averageRating: data.averageRating,
    ratingPercentages: data.ratingPercentages,
    result: data.rows,
  });
});

exports.getUserRating = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { id: course_id } = req.params;
  const query = `select rating,comment,id from reviews where user_id=? and course_id=?`;
  let [result] = await pool.query(query, [id, course_id]);
  result = result[0];
  sendResponse(res, 200, result);
});

exports.updateReview = asyncChoke(async (req, res, next) => {
  const { rating, comment } = req.body;
  const { id } = req.params;
  const [review] = await pool.query(`SELECT * FROM reviews where id=?`, [id]);

  if (review.length === 0) return next(new AppError(400, "no review found"));

  const query = `update reviews set rating=? ,comment=? where id=?`;
  await pool.query(query, [rating, comment, id]);

  sendResponse(res, 200, "rating updated");
});

exports.deleteReview = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const [result] = await pool.query(`SELECT * FROM reviews where id=?`, [id]);

  if (!result.length)
    return next(new AppError(400, "This is not your review."));

  await findAndDelete("reviews", { id });

  sendResponse(res, 203, "Deleted review");
});
