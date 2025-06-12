const { pool } = require("../Config/database");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { uploadFile } = require("../Utils/uploadProfile");
const { findAndUpdate, setActive, create } = require("./handlerFactory");

exports.updateUser = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const userDetails = req.body;

  const [results] = await findAndUpdate(
    "users",
    { ...userDetails["users"] },
    { id }
  );
  await findAndUpdate(
    "profiles",
    { ...userDetails["profile"] },
    { user_id: id }
  );

  if (!results.affectedRows)
    return next(new AppError(404, "No such user found"));

  res.status(200).json({
    status: "Success",
    // data: results[0],
  });
});

exports.getAllUsers = asyncChoke(async (req, res, next) => {
  const query = `select * from users`;
  const [result] = await pool.query(query);
  res.status(200).json({
    status: "Success",
    data: result,
  });
});

exports.getOtherExperts = asyncChoke(async (req, res, next) => {
  const { search } = req.query;
  let partialQuery = ``;

  if (search) {
    partialQuery = `AND name like ? `;
  }
  const query = `select id,name,profile_picture ,email from users 
  where status=1 and user_type="expert" and id!=? ${partialQuery} `;
  const [result] = await pool.query(query, [req.user.id, `%${search}%`]);

  if (result.length === 0) return next(new AppError(401, "No expert found"));

  res.status(200).json({
    status: "Success",
    data: result,
  });
});

// exports.getAllExperts = asyncChoke(async (req, res, next) => {
//   const query = `select id,name,profile_picture from users where status=1 and user_type="expert"`;
//   const [result] = await pool.query(query);
//   res.status(200).json({
//     status: "Success",
//     data: result,
//   });
// });

exports.getprofile = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const query = `SELECT 
  users.id,
  users.name,
  users.profile_picture,
  users.user_type,
  users.email,
  users.password,
  profiles.bio,
  profiles.company_name, 
  profiles.website,
  profiles.age,
  profiles.height,
  profiles.wins,
  profiles.losses,
  profiles.fighter_class,
  profiles.kto_percentage,
  profiles.submission_percentage,
  profiles.country,
  SUBSTRING_INDEX(profiles.social_media_links, ',', 1) AS youtube,
  SUBSTRING_INDEX(SUBSTRING_INDEX(profiles.social_media_links, ',', -1), ',', 1) AS twitter
FROM users 
left JOIN profiles ON users.id = profiles.user_id 
WHERE users.id = ?;
`;
  const [result] = await pool.query(query, [id]);

  // result[0].profile_picture =
  //   req.protocol +
  //   "://" +
  //   req.get("host") +
  //   "/profilePictures/" +
  //   result[0].profile_picture;

  res.status(200).json({
    status: "Success",
    data: result,
  });
});

exports.deleteUser = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const query = `update users set status=0 where id=?`;
  await pool.query(query, [id]);

  res.status(200).json({
    status: "Success",
  });
});

exports.updateProfile = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { name, company_name, youtube, twitter, bio, website, age, height, wins, losses, fighter_class, kto_percentage, submission_percentage, country } = req.body;
  const profile = req.files;
console.log(req.body);
  let profileUrl;
  // const profile_picture = `${req.protocol}://${req.get(
  //   "host"
  // )}/profilePictures/${req.file.filename}`;

  try{

    // Convert empty strings to NULL for numeric fields
const ageValue = age ? parseInt(age) : null;
const heightValue = height ? height : null; // Keep as VARCHAR
const winsValue = wins ? parseInt(wins) : null;
const lossesValue = losses ? parseInt(losses) : null;
const ktoPercentageValue = kto_percentage ? parseFloat(kto_percentage) : null;
const submissionPercentageValue = submission_percentage ? parseFloat(submission_percentage) : null;
const fighterClassValue = fighter_class ? fighter_class : null; // Convert empty string to NULL
const countryValue = country ? country : null; // Keep as VARCHAR
  

  if (profile.profile_picture) {
    profileUrl = await uploadFile(profile.profile_picture);
    const query = `UPDATE users
      SET profile_picture = ? WHERE id = ?;
  `;
    await pool.query(query, [profileUrl, id]);
  }

  const query = `UPDATE users
      SET name = ? WHERE id = ?;
  `;
  await pool.query(query, [name, id]);

  if (req.user.user_type === "expert") {
    let social_media = "";

    if (youtube && twitter) {
      social_media = `${youtube},${twitter}`;
    } else if (youtube) {
      social_media = youtube;
    } else if (twitter) {
      social_media = twitter;
    }
    const profilequery = `update profiles set bio=? ,social_media_links=?,company_name=?,website=?,
     age=?,height=?,wins=?,losses=?,fighter_class=?,kto_percentage=?,submission_percentage=?,country=?

      where user_id=?`;
    await pool.query(profilequery, [
      bio,
      social_media,
      company_name,
      website,
      ageValue,
      heightValue,
      winsValue,
      lossesValue,
      fighterClassValue,
      ktoPercentageValue,
      submissionPercentageValue,
      countryValue,
      id,
    ]);
  }

  res.status(200).json({
    status: "Success",
  });

  } catch (error) {
    console.log(error);
    return next(new AppError(400, "Failed to update profile"));
  }
});

// exports.updateVedioCpmpletion = asyncChoke(async (req, res, next) => {
//   const { id } = req.user;
//   const { course_id, lesson_id } = req.body;

//   await create("user_progress", {
//     user_id: id,
//     course_id,
//     lesson_id,
//     completed: true,
//   });

//   const query = `UPDATE users_courses
//     SET completion_percentage = (
//     SELECT (COUNT(case when completed = true then 1 else null end) * 100.0 / COUNT(*))
//     FROM user_progress
//     WHERE user_id = ? AND course_id = ?)
//     WHERE user_id = ? AND course_id = ?;`;

//   const [result] = await pool.query(query, [id, course_id, id, course_id]);

//   res.status(200).json({
//     status: "success",
//     message: "progess recorded",
//   });
// });

exports.myLearning = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { status } = req.query;
  let partialquery = ``;
  let favouritequery = `LEFT JOIN favourite_courses fc ON fc.course_id=c.id AND fc.user_id = ?`;
  let whereClause = `WHERE c.id IN (SELECT course_id FROM users_courses WHERE user_id = ?)`;

  if (status === "completed") {
    partialquery = ` AND completion_percentage = 100`;
  }

  if (status === "ongoing") {
    partialquery = ` AND completion_percentage < 100`;
  }

  if (status === "favourite") {
    favouritequery = ` JOIN favourite_courses fc ON fc.course_id=c.id AND fc.user_id = ?`;
    whereClause = ``;
  }

  const query = `SELECT 
    c.id,
    c.title,
    c.description,
    c.price, 
    floor(c.price - (c.price * c.discount / 100)) AS discounted_price,
    u.name,
    u.profile_picture AS expert_profile,
    u.id AS expert_id,
    c.thumbnail,
    cat.name AS category,
    GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC SEPARATOR ', ') AS tags,
    If(fc.user_id IS NOT NULL ,1,0)AS is_favourite,
    IF(users_courses.user_id IS NOT NULL, 1, 0) AS is_purchased,
    IF(cart.user_id IS NOT NULL, 1, 0) AS in_cart,
    COALESCE(ANY_VALUE(users_courses.completion_percentage), 0) AS completion_percentage,
    COALESCE(ANY_VALUE(r.rating), NULL) AS user_rating
FROM 
    courses c
JOIN
    users u ON c.expert_id = u.id
JOIN 
    categories cat ON c.category_id = cat.id
LEFT JOIN 
    course_tags ct ON ct.course_id = c.id
LEFT JOIN 
    tags t ON t.id = ct.tag_id
LEFT JOIN 
    reviews r ON r.course_id = c.id AND r.user_id = ?
LEFT JOIN 
    users_courses ON users_courses.course_id = c.id AND users_courses.user_id = ?
LEFT JOIN 
    cart ON cart.course_id = c.id AND cart.user_id = ?
${favouritequery}
${whereClause}
${partialquery}
GROUP BY 
    c.id, c.title, c.description, c.price, c.discount, u.name, u.id, c.thumbnail, cat.name;

`;
  const [result] = await pool.query(query, [id, id, id, id, id, id]);

  if (result.length === 0) return next(new AppError(404, "No courses found"));

  res.status(200).json({
    status: "Success",
    data: {
      course: result,
    },
  });
});

exports.profileCompletion = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  let query;

  if (req.user.user_type === "user" || req.user.user_type === "admin") {
    query = `select name,email,profile_picture from users 
  JOIN profiles ON
  profiles.user_id=users.id
  WHERE
  users.id=?`;
  } else if (req.user.user_type === "expert") {
    query = `select name,email,profile_picture,bio,company_name,website,social_media_links from users 
  JOIN profiles ON
  profiles.user_id=users.id
  WHERE
  users.id=?`;
  }
  const [user] = await pool.query(query, [id]);

  if (user.length === 0) {
    return next(new AppError(404, "user not found"));
  }
  const totalFields = Object.keys(user[0]).length;

  const filledFields = Object.values(user[0]).filter(
    (field) => field !== null
  ).length;

  const profileCompletion = Math.round((filledFields / totalFields) * 100);

  res.status(200).json({
    status: "Success",
    data: {
      profileCompletion: `${profileCompletion}%`,
    },
  });
});

exports.getOrderHistory = asyncChoke(async (req, res, next) => {
  console.log("orders");
  const query = `select title, payment_type,
  payment_date,transaction_id,
  amount AS discounted_price
  from payments join courses on
  payments.course_id=courses.id
  where payments.user_id=?`;
  const [orders] = await pool.query(query, [req.user.id]);

  if (orders.length === 0)
    return next(new AppError(404, "no order history found"));

  orders.forEach((el) => {
    if (el.payment_type === "coins")
      el.coins = el.discounted_price / process.env.POINT;
  });

  res.status(200).json({
    status: "Success",
    data: {
      orders,
    },
  });
});

exports.getCoinsPrchaseHistory = asyncChoke(async (req, res, next) => {
  const query = ` select points,payment_date,amount ,payment_status
  from user_points where user_points.user_id=?`;
  const [coins] = await pool.query(query, [req.user.id]);
  console.log(coins);
  if (coins.length === 0) return next(new AppError(404, "No coins purchased"));

  res.status(200).json({
    status: "Success",
    data: {
      coins,
    },
  });
});

exports.userWallet = asyncChoke(async (req, res, next) => {
  const query = `SELECT 
    COALESCE(
        (SELECT points 
         FROM user_points 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1
        ), 0
    ) AS last_purchase,
    (SELECT 
         COALESCE(SUM(points), 0) 
     FROM 
         user_points 
     WHERE 
         user_id = ?
    ) AS total_points
;
  `;

  let [lastPurchase] = await pool.query(query, [req.user.id, req.user.id]);

  const coins = ` SELECT  
    COALESCE(SUM(amount), 0) as usedCoins
FROM 
    payments
WHERE 
    user_id = ? and payment_type=?
`;
  let [usedCoins] = await pool.query(coins, [req.user.id, "coins"]);
  usedCoins = usedCoins[0].usedCoins / process.env.POINT;

  lastPurchase[0].total_points = lastPurchase[0].total_points - usedCoins;

  res.status(200).json({
    status: "Success",
    data: lastPurchase,
  });
});

exports.getCertificate = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { courseId } = req.params;
  // console.log(id, courseId);
  const query = `SELECT 
    courses.title, 
    users.name AS user, 
    certificates.certificate_id, 
    certificates.created_at, 
    courses.total_duration,
    expert.name AS expert_name  -- Expert's name
FROM 
    courses 
JOIN 
    certificates ON courses.id = certificates.course_id
JOIN 
    users ON users.id = certificates.user_id  -- User who earned the certificate
JOIN 
    users AS expert ON expert.id = courses.expert_id  -- Expert of the course
WHERE 
    users.id = ? AND courses.id = ?;
`;
  let [result] = await pool.query(query, [id, courseId]);
  result = result[0];

  if (!result) return next(new AppError(404, "no certificate found"));
  res.status(200).json({
    status: "Success",
    data: result,
  });
});

exports.getCoinsCost = asyncChoke(async (req, res, next) => {
  const { points } = req.params;
  const amount = process.env.POINT * points;

  res.status(200).json({
    status: "Success",
    amount,
  });
});

exports.purchasePoints = asyncChoke(async (req, res, next) => {
  let { points } = req.body;
  points = parseInt(points);
  if (!points || points === 0)
    return next(new AppError(401, "please enter coins to purchase"));

  const { id } = req.user;
  const amount = process.env.POINT * points;

  console.log(amount, points, id);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: "Purchase Points",
          },
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.CLIENT_DOMAIN}/userWallet`,
    cancel_url: `${process.env.CLIENT_DOMAIN}`,
    metadata: {
      user_id: id,
      points: points,
      sessionType: "purchase_points",
    },
  });

  // console.log(session);

  res.status(200).json({
    status: "Success",
    session,
  });
});

exports.createPointsCheckout = async (session) => {
  const paymentDate = new Date(session.created * 1000);
  console.log(paymentDate);

  await create("user_points", {
    user_id: session.metadata.user_id,
    amount: session.amount_total / 100,
    points: session.metadata.points,
    payment_type: session.payment_method_types,
    payment_status: session.payment_status,
    transaction_id: session.payment_intent,
    payment_date: new Date(paymentDate),
  });
};


exports.bookSeminar = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const {full_name, email, phone_number, inquery_about, date, location, topics, expert_id} = req.body;
  const query = `INSERT INTO seminar_booking (full_name, email, phone_number, inquiry_about, date, location, topics, expert_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  await pool.query(query, [full_name, email, phone_number, inquery_about, date, location, topics, expert_id, id]);
  res.status(200).json({
    status: "success",
    message: "Seminar booked successfully",
  });
});



