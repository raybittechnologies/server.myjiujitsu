const { pool } = require("../Config/database");
const {
  isValidEmail,
  generateRandomString,
  hashPassword,
} = require("../Models/userModel");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const Email = require("../Utils/mailer");
const { findAndUpdate, create } = require("./handlerFactory");

exports.adminDashboard = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  let { from, to } = req.query;

  const query = `SELECT 
    COUNT(distinct users_courses.user_id) AS total_students,
    IFNULL(
        (SELECT SUM(amount)
         FROM payments),0
    ) AS total_revenue,
      IFNULL(
        (SELECT SUM((commission_rate*amount)/100)
         FROM payments),0
    ) AS total_commission,
    IFNULL(
        (SELECT COUNT(*) 
          FROM courses),
     0) AS total_courses,
     IFNULL(
        (SELECT COUNT(*) 
    FROM users
    WHERE user_type="expert" AND status=1),
     0) AS total_experts
FROM 
    courses
JOIN 
    users_courses ON courses.id = users_courses.course_id
  `;

  let [result] = await pool.query(query);

  const q1 = `select title,id,enrolled from courses order by enrolled desc limit 5`;
  const [coursesInDemand] = await pool.query(q1);

  let total_users = {};
  const q2 = ` select count(*) as certified_users from users_courses where completion_percentage=100`;
  const [certified_users] = await pool.query(q2);

  total_users.certified_users = certified_users[0].certified_users;
  const uncertified_users =
    result[0].total_students - certified_users[0].certified_users;
  total_users.uncertified_users = uncertified_users;

  res.status(200).json({
    status: "success",
    data: {
      enrolls: result[0],
      coursesInDemand,
      total_users,
    },
  });
});

exports.dashboardGraphs = asyncChoke(async (req, res, next) => {
  let { type } = req.query;
  let q1, q2, from, to;

  if (type === "week") {
    const today = new Date();

    let dayOfWeek = today.getDay();

    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - dayOfWeek));

    from = startOfWeek.toISOString().split("T")[0];
    to = endOfWeek.toISOString().split("T")[0];
  } else if (type === "month") {
    const today = new Date();

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    from = startOfMonth.toISOString().split("T")[0];
    to = endOfMonth.toISOString().split("T")[0];
  } else if (type === "year") {
    const today = new Date();

    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const endOfYear = new Date(today.getFullYear(), 11, 31);

    from = startOfYear.toISOString().split("T")[0];
    to = endOfYear.toISOString().split("T")[0];
  }

  //data for graph of weekly enrollments
  if (type === "week") {
    q1 = `WITH week_dates AS (
    SELECT
        ? AS week_start, 
        ? AS week_end    
),
days_of_week AS (
    SELECT
        week_start + INTERVAL daynum DAY AS enrollment_date
    FROM (
        SELECT 0 AS daynum UNION ALL
        SELECT 1 UNION ALL
        SELECT 2 UNION ALL
        SELECT 3 UNION ALL
        SELECT 4 UNION ALL
        SELECT 5 UNION ALL
        SELECT 6
    ) AS days
    CROSS JOIN week_dates
    WHERE week_start + INTERVAL daynum DAY <= week_end
)
SELECT
    d.enrollment_date,
    COALESCE(COUNT(u.id), 0) AS daily_enrolled
FROM days_of_week d
LEFT JOIN users_courses u ON DATE(u.created_at) = d.enrollment_date
GROUP BY d.enrollment_date
ORDER BY d.enrollment_date;
  
  `;
  }
  if (type === "month") {
    q1 = `WITH month_dates AS (
        SELECT
            ? AS month_start,  
            LAST_DAY(?) AS month_end 
    ),
    weeks_of_month AS (
        SELECT
            DATE_ADD(month_start, INTERVAL (weeknum - 1) * 7 DAY) AS week_start,
            LEAST(DATE_ADD(month_start, INTERVAL weeknum * 7 - 1 DAY), month_end) AS week_end
        FROM (
            SELECT 1 AS weeknum UNION ALL
            SELECT 2 UNION ALL
            SELECT 3 UNION ALL
            SELECT 4 UNION ALL
            SELECT 5 UNION ALL
            SELECT 6
        ) AS weeks
        CROSS JOIN month_dates
        WHERE DATE_ADD(month_start, INTERVAL (weeknum - 1) * 7 DAY) <= month_end
    )
    SELECT
        w.week_start,
        w.week_end,
        COALESCE(COUNT(u.id), 0) AS weekly_enrolled
    FROM weeks_of_month w
    LEFT JOIN users_courses u ON DATE(u.created_at) BETWEEN w.week_start AND w.week_end
    GROUP BY w.week_start, w.week_end
    ORDER BY w.week_start;`;
  }

  if (type === "year") {
    q1 = `WITH year_dates AS (
    SELECT
        CONCAT(?, '-01-01') AS year_start,
        CONCAT(?, '-01-01') AS year_end 
),
months_of_year AS (
    SELECT
        DATE_FORMAT(DATE_ADD(year_start, INTERVAL (monthnum - 1) MONTH), '%Y-%m-01') AS month_start,
        DATE_FORMAT(LAST_DAY(DATE_ADD(year_start, INTERVAL (monthnum - 1) MONTH)), '%Y-%m-%d') AS month_end
    FROM (
        SELECT 1 AS monthnum UNION ALL
        SELECT 2 UNION ALL
        SELECT 3 UNION ALL
        SELECT 4 UNION ALL
        SELECT 5 UNION ALL
        SELECT 6 UNION ALL
        SELECT 7 UNION ALL
        SELECT 8 UNION ALL
        SELECT 9 UNION ALL
        SELECT 10 UNION ALL
        SELECT 11 UNION ALL
        SELECT 12
    ) AS months
    CROSS JOIN year_dates
)
SELECT
    m.month_start,
    m.month_end,
    COALESCE(COUNT(u.id), 0) AS monthly_enrolled
FROM months_of_year m
LEFT JOIN users_courses u ON DATE(u.created_at) BETWEEN m.month_start AND m.month_end
GROUP BY m.month_start, m.month_end
ORDER BY m.month_start;
`;
  }

  if (type === "all time") {
    q1 = `
      WITH year_range AS (
          SELECT 
              YEAR(MIN(u.created_at)) AS start_year,
              YEAR(CURDATE()) AS end_year
          FROM users_courses u
      ),
      years_of_data AS (
          SELECT 
              start_year + yearnum AS year_start
          FROM (
              SELECT 0 AS yearnum UNION ALL
              SELECT 1 UNION ALL
              SELECT 2 UNION ALL
              SELECT 3 UNION ALL
              SELECT 4 UNION ALL
              SELECT 5 UNION ALL
              SELECT 6 UNION ALL
              SELECT 7 UNION ALL
              SELECT 8 UNION ALL
              SELECT 9 -- Add more unions if needed for additional years
          ) AS numbers
          CROSS JOIN year_range
          WHERE start_year + yearnum <= end_year
      )
      SELECT 
          y.year_start AS year,
          COALESCE(COUNT(u.id), 0) AS yearly_enrolled
      FROM years_of_data y
      LEFT JOIN users_courses u 
          ON YEAR(u.created_at) = y.year_start
      JOIN courses c ON u.course_id = c.id
      GROUP BY y.year_start
      ORDER BY y.year_start;
    `;
  }
  const [Enrolled] = await pool.query(q1, [from, to]);

  if (type === "week") {
    console.log("week");
    //data for graph of weekly revenue
    q2 = `WITH week_dates AS (
     SELECT
        ? AS week_start, 
        ? AS week_end    
),
  days_of_week AS (
      SELECT
          week_start + INTERVAL daynum DAY AS payment_date
      FROM (
          SELECT 0 AS daynum UNION ALL
          SELECT 1 UNION ALL
          SELECT 2 UNION ALL
          SELECT 3 UNION ALL
          SELECT 4 UNION ALL
          SELECT 5 UNION ALL
          SELECT 6
      ) AS days
      CROSS JOIN week_dates
      WHERE week_start + INTERVAL daynum DAY <= week_end
  )
  SELECT
      d.payment_date,
      COALESCE(SUM(p.amount), 0) AS daily_revenue
  FROM days_of_week d
  LEFT JOIN payments p ON DATE(p.payment_date) = d.payment_date
  GROUP BY d.payment_date
  ORDER BY d.payment_date;
  `;
  }

  if (type === "month") {
    q2 = `WITH month_dates AS (
    SELECT
        ? AS month_start,  -- Specify the start of the month (e.g., '2024-09-01')
        LAST_DAY(?) AS month_end  -- Automatically get the last day of the month
),
weeks_of_month AS (
    SELECT
        DATE_ADD(month_start, INTERVAL (weeknum - 1) * 7 DAY) AS week_start,
        LEAST(DATE_ADD(month_start, INTERVAL weeknum * 7 - 1 DAY), month_end) AS week_end
    FROM (
        SELECT 1 AS weeknum UNION ALL
        SELECT 2 UNION ALL
        SELECT 3 UNION ALL
        SELECT 4 UNION ALL
        SELECT 5 UNION ALL
        SELECT 6
    ) AS weeks
    CROSS JOIN month_dates
    WHERE DATE_ADD(month_start, INTERVAL (weeknum - 1) * 7 DAY) <= month_end
)
SELECT
    w.week_start,
    w.week_end,
    COALESCE(SUM(p.amount), 0) AS weekly_revenue
FROM weeks_of_month w
LEFT JOIN payments p ON DATE(p.payment_date) BETWEEN w.week_start AND w.week_end
GROUP BY w.week_start, w.week_end
ORDER BY w.week_start;
`;
  }

  if (type === "year") {
    q2 = `WITH year_dates AS (
    SELECT
        CONCAT(?, '-01-01') AS year_start ,
        CONCAT(?, '-01-01') AS year_end
),
months_of_year AS (
    SELECT
        DATE_FORMAT(DATE_ADD(year_start, INTERVAL (monthnum - 1) MONTH), '%Y-%m-01') AS month_start,
        DATE_FORMAT(LAST_DAY(DATE_ADD(year_start, INTERVAL (monthnum - 1) MONTH)), '%Y-%m-%d') AS month_end
    FROM (
        SELECT 1 AS monthnum UNION ALL
        SELECT 2 UNION ALL
        SELECT 3 UNION ALL
        SELECT 4 UNION ALL
        SELECT 5 UNION ALL
        SELECT 6 UNION ALL
        SELECT 7 UNION ALL
        SELECT 8 UNION ALL
        SELECT 9 UNION ALL
        SELECT 10 UNION ALL
        SELECT 11 UNION ALL
        SELECT 12
    ) AS months
    CROSS JOIN year_dates
)
SELECT
    m.month_start,
    m.month_end,
    COALESCE(SUM(p.amount), 0) AS monthly_revenue
FROM months_of_year m
LEFT JOIN payments p ON DATE(p.payment_date) BETWEEN m.month_start AND m.month_end
GROUP BY m.month_start, m.month_end
ORDER BY m.month_start;
`;
  }
  if (type === "all time") {
    q2 = `
      WITH year_range AS (
    SELECT 
        YEAR(MIN(p.payment_date)) AS start_year, 
        YEAR(CURDATE()) AS end_year               
    FROM payments p
),
years_of_data AS (
    SELECT 
        start_year + yearnum AS year_start        
    FROM (
        SELECT 0 AS yearnum UNION ALL           
        SELECT 1 UNION ALL
        SELECT 2 UNION ALL
        SELECT 3 UNION ALL
        SELECT 4 UNION ALL
        SELECT 5 UNION ALL
        SELECT 6 UNION ALL
        SELECT 7 UNION ALL
        SELECT 8 UNION ALL
        SELECT 9 
    ) AS numbers
    CROSS JOIN year_range
    WHERE start_year + yearnum <= end_year      
)
SELECT 
    y.year_start AS year,                       
    COALESCE(SUM(p.amount), 0) AS yearly_revenue 
FROM years_of_data y
LEFT JOIN payments p 
    ON YEAR(p.payment_date) = y.year_start                                 
GROUP BY y.year_start                           
ORDER BY y.year_start;`;
  }
  const [Revenue] = await pool.query(q2, [from, to]);

  res.status(200).json({
    status: "success",
    data: {
      Enrolled,
      Revenue,
    },
  });
});

// fetch all experts data along with their withdrawals
exports.expertsForAdmin = asyncChoke(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 5;
  const offset = (page - 1) * limit;

  const query = `
SELECT
    users.id,
    users.name,
    users.profile_picture,
    users.created_at,
    users.status,
    COALESCE(
        (SELECT COUNT(c.id) FROM courses c WHERE c.expert_id = users.id), 0
    ) AS total_courses,
    COALESCE(
        (SELECT ROUND(SUM(p.amount - ((p.amount * p.commission_rate) / 100)), 2)
         FROM payments p
         JOIN courses c ON p.course_id = c.id
         WHERE c.expert_id = users.id), 0
    ) AS total_earnings,
    COALESCE(
        (SELECT SUM(w.withdrawal_amount) FROM withdrawal w WHERE w.expert_id = users.id), 0
    ) AS total_withdrawn_amount
FROM users
WHERE users.user_type = 'expert' AND users.status = 1
LIMIT ? OFFSET ?;
`;

const [experts] = await pool.query(query, [limit, offset]);

if (experts.length === 0) return next(new AppError(404, "no experts found"));

experts.forEach((expert) => {
  expert.payable_amount = Math.floor(expert.total_earnings - expert.total_withdrawn_amount);
  delete expert.total_withdrawn_amount;
});

res.status(200).json({
  status: "Success",
  data: { experts },
});

});

// add expert
exports.addExpert = asyncChoke(async (req, res, next) => {
  let { email, name } = req.body;
  if (!name || !email) {
    return next(new AppError(400, "provide all inputs"));
  }
  // const profile_picture = req.file.path;

  if (!isValidEmail(email)) {
    return next(new AppError(400, "The email you provided is not valid"));
  }

  const randomString = generateRandomString();
  password = await hashPassword(randomString);

  const user = await create("users", {
    email,
    password,
    name,
    user_type: "expert",
    status: true,
    email_verified: true,
    email_verified_at: new Date(Date.now()),
  });

  await create("profiles", {
    user_id: user.insertId,
  });

  //SEND EMAIL
  const uri = `<p> Email: ${email} <br> Password:${randomString} </p>`;
  new Email(email, uri, name).sendExpertWelcome();

  res.status(200).json({
    status: "Success",
    Message: `Expert added successfully`,
  });
});

// getting all users on admin dashboard
exports.usersForAdmin = asyncChoke(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 5;
  const offset = (page - 1) * limit;

  const query = ` SELECT 
    users.id, 
    users.name,
    users.profile_picture,
    users.created_at,
    users.status,
    count(users.id)as total_courses
FROM 
    users 
JOIN 
    users_courses
ON 
    users_courses.user_id = users.id
group by users.id
 LIMIT ? OFFSET ?;
`;

  const [users] = await pool.query(query, [limit, offset]);
  if (users.length === 0) return next(new AppError(404, "no users found"));

  res.status(200).json({
    status: "Success",
    data: {
      users,
    },
  });
});

// pay all experts on admin dashboard
// exports.payExpertList = asyncChoke(async (req, res, next) => {
//   const query = `SELECT
//   users.id,
//   users.name,
//   users.profile_picture,
//   COALESCE(p.total_amount, 0) AS total_amount,
//   COALESCE(w.total_withdrawn_amount, 0) AS total_withdrawn_amount,
//   w.latest_withdrawal_date
// FROM
//   users
// JOIN (
//   SELECT
//       courses.expert_id,
//       SUM(payments.amount) AS total_amount
//   FROM
//       courses
//   JOIN
//       payments
//   ON
//       payments.course_id = courses.id
//   GROUP BY
//       courses.expert_id
// ) AS p
// ON
//   p.expert_id = users.id
// JOIN (
//   SELECT
//       expert_id,
//       SUM(withdrawal.withdrawal_amount) AS total_withdrawn_amount,
//       MAX(withdrawal.withdrawal_date) AS latest_withdrawal_date
//   FROM
//       withdrawal
//   GROUP BY
//       expert_id
// ) AS w
// ON
//   w.expert_id = users.id
// `;
//   const [experts] = await pool.query(query);

//   const commissionquery = `select commission from commission`;
//   const [commission] = await pool.query(commissionquery);

//   const serviceChargesPercentage = commission[0].commission;

//   experts.forEach((expert) => {
//     const serviceCharges =
//       (serviceChargesPercentage * expert.total_amount) / 100;

//     expert.payable_amount = Math.floor(
//       expert.total_amount - serviceCharges - expert.total_withdrawn_amount
//     );

//     delete expert.total_amount;
//     delete expert.total_withdrawn_amount;
//   });

//   res.status(200).json({
//     status: "Success",
//     data: {
//       experts,
//     },
//   });
// });

exports.adminPaidHistory = asyncChoke(async (req, res, next) => {
  // const page = parseInt(req.query.page, 10) || 1;
  // const limit = parseInt(req.query.limit, 10) || 10;
  // const offset = (page - 1) * limit;

  // const [countQuery] = await pool.query(
  //   `select count(*) as total_history from withdrawal`
  // );

  const query = `
    SELECT 
      users.name,
      users.profile_picture,
      withdrawal.withdrawal_amount,
      withdrawal.withdrawal_date,
      withdrawal.transaction_id,
      withdrawal.withdrawal_status
    FROM 
      users 
    JOIN 
      withdrawal ON withdrawal.expert_id = users.id
    -- LIMIT ? OFFSET ?;
  `;

  const [history] = await pool.query(query);

  if (history.length === 0)
    return next(new AppError(404, "no transactions found"));

  res.status(200).json({
    status: "Success",
    data: {
      // totalEntries: countQuery[0].total_history,
      history,
    },
  });
});

exports.getCommissionRate = asyncChoke(async (req, res, next) => {
  const query = `select id,commission from commission`;
  const [commission] = await pool.query(query);

  res.status(200).json({
    status: "Success",
    commission: commission[0],
  });
});

exports.updateCommision = asyncChoke(async (req, res, next) => {
  const { commission } = req.body;
  const { id } = req.params;
  await findAndUpdate("commission", { commission }, { id });

  res.status(200).json({
    status: "Success",
    message: "commission updated successfully",
  });
});

// GET PAYOUT REQUESTS
exports.getPayoutRequest = asyncChoke(async (req, res, next) => {
  const query = `select payout_requests.id ,name,profile_picture,
  payout_requests.created_at,amount,is_paid
  from payout_requests 
  join users on payout_requests.expert_id=users.id
  where is_paid=0`;
  const [requests] = await pool.query(query);

  if (requests.length === 0)
    return next(new AppError(401, "no requests found"));

  res.status(200).json({
    status: "Success",
    data: requests,
  });
});

exports.suspendUser = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  const query = `update users set status=? where id=?`;
  await pool.query(query, [status, id]);

  res.status(200).json({
    status: "Success",
    message: "account suspended",
  });
});

// exports.notificationRead = asyncChoke(async (req, res, next) => {
//   const { ids } = req.body;

//   const placeholders = ids.map(() => "?").join(",");

//   const query = `UPDATE payout_requests SET is_read = 1 WHERE id IN (${placeholders})`;
//   await pool.query(query, [...ids]);

//   res.status(200).json({
//     status: "Success",
//     message: "Notifications marked as read",
//   });
// });

exports.approveCourse = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  let { status, remarks } = req.body;
  remarks = remarks || null;

  const q = ` select * from review_requests where id = ?`;
  const [request] = await pool.query(q, [id]);

  if (request.length === 0)
    return next(new AppError(401, "no requests found with this id"));

  const query = `update courses set status=? where id=?`;
  await pool.query(query, [status, request[0].course_id]);

  const query2 = `update review_requests set reviewed=1,remarks=? where id=?`;
  await pool.query(query2, [remarks, id]);

  res.status(200).json({
    status: "Success",
    message: "course reviewed",
  });
});

exports.getApproveRequests = asyncChoke(async (req, res, next) => {
  const query = `SELECT 
  review_requests.id AS request_id,
  courses.id AS course_id, 
  courses.title, 
  users.name AS expert, 
  courses.price, 
  courses.thumbnail
FROM review_requests 
JOIN courses ON courses.id = review_requests.course_id
JOIN users ON users.id = courses.expert_id
WHERE review_requests.reviewed =0;
`;
  const [results] = await pool.query(query);

  // if (results.length === 0) return next(new AppError(404, "no requests found"));

  res.status(200).json({
    status: "Success",
    data: results,
  });
});
