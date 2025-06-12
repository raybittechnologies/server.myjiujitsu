const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { getExpertsAllCourses } = require("./coursesController");
const { create, findOne, findAndUpdate, findAndDelete } = require("./handlerFactory");




exports.addFigherHistory = asyncChoke(async (req, res, next) => {
  console.log(req.body);
  const {result, fighter_name, event_name, event_date, method, rounds, time, video_link, submission, ko} = req.body;
  if(!result || !fighter_name || !event_name || !event_date || !method || !rounds || !time || !video_link) {
    return next(new AppError(401, "provide all inputs"));
  }
  const date = new Date(event_date);
  await create("fighter_history", {result, fighter_name, event_name, date:date, method_referee:method, rounds, time, fight_video_link:video_link, submission, ko, expert_id: req.user.id});
  res.status(200).json({
    status: "success",
    message: "Fighter history added successfully",
  });
});

exports.updateFighterHistory = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const {result, fighter_name, event_name, event_date, method, rounds, time, video_link, submission, ko} = req.body;
  const date = new Date(event_date);
  await findAndUpdate("fighter_history", {result, fighter_name, event_name, date:date, method_referee:method, rounds, time, fight_video_link:video_link, submission, ko}, { expert_id: id });
  res.status(200).json({
    status: "success",
    message: "Fighter history updated successfully",
  });
});

exports.deleteFighterHistory = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  await findAndDelete("fighter_history", { id });
  res.status(200).json({
    status: "success",
    message: "Fighter history deleted successfully",
  });
});

exports.getFighterHistory = asyncChoke(async (req, res, next) => {
  const { id } = req.query;
  const query = `select * from fighter_history where expert_id=?`;
  const [result] = await pool.query(query, [id]);
  
  // Calculate statistics
  const stats = {
    total: result.length,
    win: {
      count: 0,
      ko_percentage: 0,
      submission_percentage: 0,
      decision_percentage: 0
    },
    lose: {
      count: 0,
      ko_percentage: 0,
      submission_percentage: 0,
      decision_percentage: 0
    }
  };
  
  // Count wins, losses and calculate percentages
  let winKoCount = 0;
  let winSubmissionCount = 0;
  let winDecisionCount = 0;
  let loseKoCount = 0;
  let loseSubmissionCount = 0;
  let loseDecisionCount = 0;
  
  result.forEach(fight => {
    if (fight.result.toLowerCase() === 'win') {
      stats.win.count++;
      if (fight.ko === 1) winKoCount++;
      if (fight.submission === 1) winSubmissionCount++;
      if (fight.ko === 0 && fight.submission === 0) winDecisionCount++;
    } else if (fight.result.toLowerCase() === 'lose') {
      stats.lose.count++;
      if (fight.ko === 1) loseKoCount++;
      if (fight.submission === 1) loseSubmissionCount++;
      if (fight.ko === 0 && fight.submission === 0) loseDecisionCount++;
    }
  });
  
  // Calculate percentages for wins
  if (stats.win.count > 0) {
    stats.win.ko_percentage = (winKoCount / stats.win.count) * 100;
    stats.win.submission_percentage = (winSubmissionCount / stats.win.count) * 100;
    stats.win.decision_percentage = (winDecisionCount / stats.win.count) * 100;
  }
  
  // Calculate percentages for losses
  if (stats.lose.count > 0) {
    stats.lose.ko_percentage = (loseKoCount / stats.lose.count) * 100;
    stats.lose.submission_percentage = (loseSubmissionCount / stats.lose.count) * 100;
    stats.lose.decision_percentage = (loseDecisionCount / stats.lose.count) * 100;
  }
  
  res.status(200).json({
    status: "success",
    data: result,
    statistics: stats
  });
});



exports.addPastCompetition = asyncChoke(async (req, res, next) => {
  const { competition_name, competition_date, acheavements, location, match_link } = req.body;
  if (!competition_name ||!competition_date ||!acheavements ||!location ||!match_link) {
    return next(new AppError(401, "provide all inputs"));
  }
  await create("past_competitions", { competition_name, competition_date, acheavements, location, match_link, expert_id: req.user.id });
  res.status(200).json({
    status: "success",
    message: "Past competition added successfully",
  });
});

exports.updatePastCompetition = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { competition_name, competition_date, acheavements, location, match_link } = req.body;
  await findAndUpdate("past_competitions", { competition_name, competition_date, acheavements, location, match_link }, { id });
  res.status(200).json({
    status: "success",
    message: "Past competition updated successfully",
  });
});

exports.deletePastCompetition = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  await findAndDelete("past_competitions", { id });
  res.status(200).json({
    status: "success",
    message: "Past competition deleted successfully",
  });
});



exports.getPastCompetitions = asyncChoke(async (req, res, next) => {
  const { id } = req.query;
  const query = `select * from past_competitions where expert_id=?`;
  const [result] = await pool.query(query, [id]);
  if (result.length === 0)
    return next(new AppError(404, "No past competitions found!"));
  res.status(200).json({
    status: "success",
    data: result,
  });

});

exports.addUpcomingCompetition = asyncChoke(async (req, res, next) => {
  const { competition_name, competition_date, location, match_link } = req.body;
  if (!competition_name ||!competition_date ||!location ||!match_link) {
    return next(new AppError(401, "provide all inputs"));
  }
  await create("upcoming_competitions", { competition_name, competition_date, location, match_link, expert_id: req.user.id });
  res.status(200).json({
    status: "success",
    message: "Upcoming competition added successfully",
  });
  });

exports.updateUpcomingCompetition = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { competition_name, competition_date, location, match_link } = req.body;
  await findAndUpdate("upcoming_competitions", { competition_name, competition_date, location, match_link }, { id });
  res.status(200).json({
    status: "success",
    message: "Upcoming competition updated successfully",
  });
});

exports.deleteUpcomingCompetition = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  await findAndDelete("upcoming_competitions", { id });
  res.status(200).json({
    status: "success",
    message: "Upcoming competition deleted successfully",
  });
}); 



exports.getUpcomingCompetitions = asyncChoke(async (req, res, next) => {
  const { id } = req.query;
  const query = `select * from upcoming_competitions where expert_id=?`;
  const [result] = await pool.query(query, [id]);
  if (result.length === 0)
    return next(new AppError(404, "No upcoming competitions found!"));
  res.status(200).json({
    status: "success",
    data: result,
  });
});




exports.getWalletDetails = asyncChoke(async (req, res, next) => {
  const query = `SELECT 
    w.transaction_id, 
    w.expert_id, 
    w.withdrawal_date, 
    w.withdrawal_amount,
    t.total_withdrawn_amount
FROM 
    withdrawal w
left JOIN 
    (SELECT 
        expert_id, 
         COALESCE(sum(withdrawal_amount), 0) AS total_withdrawn_amount
     FROM 
        withdrawal
     WHERE 
        expert_id = ?
     ) t 
ON 
    w.expert_id = t.expert_id
WHERE 
    w.expert_id = ?
ORDER BY 
    w.created_at DESC
LIMIT 1;
`;
  let [lastWithdrawal] = await pool.query(query, [req.user.id, req.user.id]);

  const payments = ` SELECT  
    payment_type,
    payment_date,
    payment_status,
    amount,
    COALESCE(ROUND((amount * commission_rate) / 100, 2), 0) AS service_charges,
    COALESCE(ROUND(amount - ((amount * commission_rate) / 100), 2), 0) AS payable_amount
FROM 
    payments 
JOIN 
    courses ON payments.course_id = courses.id
WHERE 
    courses.expert_id = ?;
`;
  const [orders] = await pool.query(payments, [req.user.id]);

  const totalPayableAmount = orders.reduce(
    (acc, order) => acc + Number(order.payable_amount),
    0
  );
  let payable_amount;
  if (lastWithdrawal.length === 0) {
    payable_amount = Math.floor(totalPayableAmount);
  } else {
    payable_amount = Math.floor(
      totalPayableAmount - lastWithdrawal[0].total_withdrawn_amount
    );
  }

  res.status(200).json({
    status: "Success",
    data: {
      lastWithdrawal,
      orders,
      payable_amount,
    },
  });
});

exports.expertDashboard = asyncChoke(async (req, res, next) => {
  const { id } = req.user;

  const query = `SELECT 
    COUNT(distinct users_courses.user_id) AS total_students,
    COUNT(CASE WHEN DATE(users_courses.created_at) = CURDATE() THEN 1 END) AS today_enrolled,
    IFNULL(
        (SELECT SUM(amount)
         FROM payments
         JOIN courses ON payments.course_id = courses.id
         WHERE courses.expert_id = ? ),
        0
    ) AS total_revenue,
    IFNULL(
        (SELECT SUM(amount)
         FROM payments
         JOIN courses ON payments.course_id = courses.id
         WHERE courses.expert_id = ?
           AND YEAR(payment_date) = YEAR(CURDATE())
           AND MONTH(payment_date) = MONTH(CURDATE())),
        0
    ) AS current_month_revenue
FROM 
    courses
JOIN 
    users_courses ON courses.id = users_courses.course_id
WHERE 
    courses.expert_id = ?;

`;
  let [result] = await pool.query(query, [id, id, id, id, id, id]);

  const q3 = `WITH total_reviews AS (
    SELECT COUNT(*) AS total
    FROM reviews
    JOIN courses ON courses.id = reviews.course_id
    WHERE courses.expert_id = ? 
)
SELECT
    SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) * 100.0 / total_reviews.total AS 5_stars,
    SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) * 100.0 / total_reviews.total AS 4_stars,
    SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) * 100.0 / total_reviews.total AS 3_stars,
    SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) * 100.0 / total_reviews.total AS 2_stars,
    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) * 100.0 / total_reviews.total AS 1_stars
FROM reviews
JOIN courses ON courses.id = reviews.course_id
JOIN total_reviews
WHERE courses.expert_id = ?;  
`;

  const [reviews] = await pool.query(q3, [id, id]);

  const q4 = `select title,id,enrolled from courses where expert_id=? order by enrolled desc limit 5`;
  const [coursesInDemand] = await pool.query(q4, [id]);

  res.status(200).json({
    status: "success",
    data: {
      enrolls: result[0],
      reviews,
      coursesInDemand,
    },
  });
});

exports.expertGraphs = asyncChoke(async (req, res, next) => {
  let { type } = req.query;
  let q1, q2, from, to, Enrolled;

  if (type === "week") {
    const today = new Date();

    const dayOfWeek = today.getDay();

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - dayOfWeek));

    from = startOfWeek.toISOString().split("T")[0]; // YYYY-MM-DD format
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
JOIN courses c ON u.course_id = c.id
WHERE c.expert_id = ?
GROUP BY d.enrollment_date
ORDER BY d.enrollment_date;
  
  `;
    [Enrolled] = await pool.query(q1, [from, to, req.user.id]);
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
   JOIN courses c ON u.course_id = c.id
    WHERE c.expert_id = ?
    GROUP BY w.week_start, w.week_end
    ORDER BY w.week_start;`;
    [Enrolled] = await pool.query(q1, [from, to, req.user.id]);
  }

  if (type === "year") {
    q1 = `WITH year_dates AS (
    SELECT
       ? AS year_start,
       ? AS year_end 
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
JOIN courses c ON u.course_id = c.id
WHERE c.expert_id = ?
GROUP BY m.month_start, m.month_end
ORDER BY m.month_start;
`;
    [Enrolled] = await pool.query(q1, [from, to, req.user.id]);
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
      WHERE c.expert_id = ?
      GROUP BY y.year_start
      ORDER BY y.year_start;
    `;
    [Enrolled] = await pool.query(q1, [req.user.id]);
  }

  if (type === "week") {
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
  JOIN courses c ON p.course_id = c.id
 WHERE c.expert_id = ?
  GROUP BY d.payment_date
  ORDER BY d.payment_date;
  `;
    [Revenue] = await pool.query(q2, [from, to, req.user.id]);
  }

  if (type === "month") {
    q2 = `WITH month_dates AS (
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
    COALESCE(SUM(p.amount), 0) AS weekly_revenue
FROM weeks_of_month w
LEFT JOIN payments p ON DATE(p.payment_date) BETWEEN w.week_start AND w.week_end
JOIN courses c ON p.course_id = c.id
 WHERE c.expert_id = ?
GROUP BY w.week_start, w.week_end
ORDER BY w.week_start;
`;
    [Revenue] = await pool.query(q2, [from, to, req.user.id]);
  }

  if (type === "year") {
    q2 = `WITH year_dates AS (
    SELECT
        ? AS year_start ,
        ? AS year_end
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
JOIN courses c ON p.course_id = c.id
 WHERE c.expert_id = ?
GROUP BY m.month_start, m.month_end
ORDER BY m.month_start;
`;
    [Revenue] = await pool.query(q2, [from, to, req.user.id]);
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
JOIN courses c ON p.course_id = c.id             
WHERE c.expert_id = ?                            
GROUP BY y.year_start                           
ORDER BY y.year_start;                          
`;
    [Revenue] = await pool.query(q2, [req.user.id]);
  }

  res.status(200).json({
    status: "success",
    data: {
      Enrolled,
      Revenue,
    },
  });
});

exports.getWithdrawalHistory = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const query = `select transaction_id, withdrawal_date , withdrawal_amount, withdrawal_status
  from withdrawal where expert_id=? order by withdrawal_date desc`;
  const [result] = await pool.query(query, [id]);

  if (result.length === 0)
    return next(new AppError(404, " No withdrawal history found!"));
  res.status(200).json({
    status: "success",
    data: result,
  });
});

exports.createReviewRequest = asyncChoke(async (req, res, next) => {
  const { course_id } = req.body;

  const query = `select * from courses where id=? AND status="approved"`;
  const [result] = await pool.query(query, [course_id]);

  if (result.length)
    return next(new AppError(401, "This course is already approved"));

  const query2 = `select * from review_requests where course_id=? and reviewed=0  `;
  const [result2] = await pool.query(query2, [course_id]);

  if (result2.length !== 0)
    return next(new AppError(401, "Review request already sent"));

  const query3 = `SELECT COUNT(*) AS lessonCount FROM lessons
  JOIN chapters ON chapters.id=lessons.chapter_id
  WHERE chapters.course_id=?`;
  const [lessonResult] = await pool.query(query3, [course_id]);

  if (lessonResult[0].lessonCount === 0)
    return next(new AppError(401, "This course has no lessons added"));

  await create("review_requests", { course_id });
  await findAndUpdate("courses", { status: "requested" }, { id: course_id });

  res.status(200).json({
    status: "success",
    message: "request sent successfully",
  });
});

// in progress
exports.getProfile = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const query = `SELECT 
  users.id,
  users.name,
  users.profile_picture,
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
  SUBSTRING_INDEX(SUBSTRING_INDEX(profiles.social_media_links, ',', -1), ',', 1) AS twitter,
  -- Subquery to count total reviews
  (SELECT COUNT( reviews.id) 
   FROM reviews 
   JOIN courses c ON c.id = reviews.course_id 
   WHERE c.expert_id = users.id) AS total_reviews,
  -- Subquery to count total students
  (SELECT COUNT( users_courses.user_id) 
   FROM users_courses 
   JOIN courses c ON c.id = users_courses.course_id 
   WHERE c.expert_id = users.id) AS total_students
FROM users 
JOIN profiles ON users.id = profiles.user_id 
WHERE users.id = ?;
`;
  const [result] = await pool.query(query, [id]);

  if (result.length === 0)
    return next(new AppError(404, "no expert found with thid id"));

  const courses = await getExpertsAllCourses(id, "", "live");

  res.status(200).json({
    status: "success",
    data: {
      expert: result[0],
      courses,
    },
  });
});


exports.getSeminarBookings = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const query = `
    SELECT 
      sb.*,
      u.name as user_name,
      u.profile_picture as user_profile_picture
    FROM seminar_booking sb
    JOIN users u ON sb.user_id = u.id 
    WHERE sb.expert_id = ?`;
  const [bookings] = await pool.query(query, [id]);
  res.status(200).json({
    status: "success", 
    data: bookings,
  });
});




