const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { deleteAccount } = require("./authController");
const { create, findMany, findOne } = require("./handlerFactory");
const { calculateRating } = require("./reviewController");

exports.createCart = asyncChoke(async (req, res, next) => {
  const { course_id } = req.body;
  const { id: user_id } = req.user;

  const course = `select * from users_courses where course_id=? and user_id=?`;
  const [mycourses] = await pool.query(course, [course_id, user_id]);
  console.log(mycourses);

  if (mycourses.length > 0)
    return next(new AppError(404, "this course is already purchased"));

  if (!course_id) return next(new AppError(400, "course_id is required"));

  const query = `select * from cart where user_id=? AND course_id=?`;

  const [existingCartItems] = await pool.query(query, [user_id, course_id]);
  console.log(existingCartItems);

  if (existingCartItems.length > 0) {
    return next(new AppError(400, "Course is already in the cart"));
  }

  await create("cart", { course_id, user_id });

  res.status(200).json({
    status: "success",
    message: "Course added to cart successfully",
  });
});

exports.getCart = asyncChoke(async (req, res, next) => {
  const { id } = req.user;

  const query = `select cart.id, course_id, expert_id,
  title,description,price,discount, thumbnail,
  ROUND((price - (price * discount / 100)), 2) AS discounted_price
  from cart 
  JOIN courses ON
  cart.course_id=courses.id
  JOIN users ON 
  cart.user_id=users.id
  WHERE cart.user_id=?`;
  const [cart] = await pool.query(query, [id]);

  // if (cart.length === 0) return next(new AppError(404, "Nothing in cart"));

  let totalPrice = 0;
  let priceWithoutDiscount = 0;
  let cartCourseIds = [];

  const detailedCart = await Promise.all(
    cart.map(async (cart) => {
      const ratings = await calculateRating(cart.course_id, next);
      totalPrice += Math.round(cart.discounted_price);
      priceWithoutDiscount += Math.round(cart.price);
      cartCourseIds.push(cart.course_id);
      return {
        ...cart,
        rating: ratings.averageRating,
        totalRviews: ratings.rows.length,
      };
    })
  );

  const placeholders = cartCourseIds.map(() => "?").join(",");
  let partialquery = ` WHERE courses.id NOT IN (${placeholders})`;
  if (detailedCart.length === 0) partialquery = ``;

  const allCourses = `
    SELECT courses.id, title,
      courses.description, users.name, thumbnail,
      price, discount, categories.name AS category,
       floor(price - (price * discount / 100)) AS discounted_price,
      GROUP_CONCAT(distinct tags.name ORDER BY tags.name ASC SEPARATOR ', ') AS tags,
       If(favourite_courses.user_id IS NOT NULL ,1,0)AS is_favourite,
       IF(users_courses.user_id IS NOT NULL, 1, 0) AS is_purchased
    FROM courses
    JOIN users ON courses.expert_id = users.id
    JOIN categories ON courses.category_id = categories.id 
    LEFT JOIN 
    course_tags ON course_tags.course_id = courses.id 
    LEFT JOIN 
    tags ON tags.id = course_tags.tag_id
    LEFT JOIN 
    users_courses ON users_courses.course_id = courses.id AND users_courses.user_id = ?
     LEFT JOIN
    favourite_courses ON favourite_courses.course_id=courses.id AND favourite_courses.user_id = ?
  ${partialquery}
    group by courses.id`;

  const [expertCourses] = await pool.query(allCourses, [
    id,
    id,
    ...cartCourseIds,
  ]);

  res.status(200).json({
    status: "success",
    cart: detailedCart,
    expertCourses,
    totalPrice,
    priceWithoutDiscount,
  });
});

exports.removeCart = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const query = `delete from cart where id=?`;
  const [deletedCart] = await pool.query(query, [id]);

  if (deletedCart.affectedRows === 0) {
    return next(new AppError(404, "no cart found with this id"));
  }

  res.status(200).json({
    status: "success",
    message: "cart removed",
  });
});
