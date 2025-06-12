const { pool } = require("../Config/database");
const { search } = require("../Routes/auth.routes");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { uploadFile } = require("../Utils/uploadProfile");
const { create, findAndUpdate, deleteMany } = require("./handlerFactory");
const { calculateRating } = require("./reviewController");
const jwt = require("jsonwebtoken");
const {
  S3,
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
// const { S3 } = require("@aws-sdk/client-s3");
// const s3 = new S3Client({ region: "ap-south-1" });
const { exec } = require("child_process");
const s3 = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET,
  },
});

const getCourseContent = asyncChoke(async (user, id, expert) => {
  const query = `
  SELECT chapters.title AS chapterTitle, 
         lessons.title AS lessonTitle, 
         duration,
         lessons.video_url, 
         lessons.video_type,
         chapter_id,
         lessons.thumbnail,
         lessons.id AS lesson_id,
         chapters.sequence as chapter_no,
         lessons.sequence as lesson_no,
        CASE 
        WHEN user_progress.completed = 1 THEN true
        ELSE false
    END AS completed
FROM 
    courses
JOIN 
    chapters ON chapters.course_id = courses.id
JOIN 
    lessons ON lessons.chapter_id = chapters.id 
LEFT JOIN 
    user_progress ON user_progress.course_id = courses.id 
                  AND user_progress.lesson_id = lessons.id
                  AND user_progress.user_id = ?
WHERE 
    chapters.course_id = ? 
    AND courses.expert_id = ?
ORDER BY 
    chapters.sequence, lessons.sequence;
`;

  const [rows] = await pool.query(query, [user, id, expert]);

  // let totalLessons = 0;

  const groupedResults = rows.reduce((acc, row) => {
    const {
      chapter_id,
      chapterTitle,
      lessonTitle,
      duration,
      lesson_id,
      video_url,
      video_type,
      lesson_no,
      chapter_no,
      thumbnail,
      completed,
    } = row;

    let chapter = acc.find((ch) => ch.chapter_id === chapter_id);
    if (!chapter) {
      chapter = {
        chapter_id,
        chapterTitle,
        chapter_no,
        totalDuration: 0,
        totalLessons: 0,
        lessons: [],
      };
      acc.push(chapter);
    }

    let finalVideoUrl = video_url;
    // if (video_type === "local") {
    //   finalVideoUrl = `https://elearn-pv2m.onrender.com/api/v1/courses/stream-video/${lesson_id}`;
    // }

    chapter.lessons.push({
      lesson_id,
      lessonTitle,
      duration,
      video_url: finalVideoUrl, // Either YouTube link or local streaming API
      video_type,
      lesson_no,
      thumbnail,
      completed,
    });

    chapter.totalDuration += parseInt(duration, 10);
    chapter.totalLessons += 1;

    return acc;
  }, []);

  const total_chapters = groupedResults.length;

  return {
    chapters: groupedResults,
    total_chapters,
  };
});

const getCourseContentWithotPurchase = asyncChoke(async (id, expert) => {
  const query = `
  SELECT chapters.title AS chapterTitle, 
         lessons.title AS lessonTitle, 
         duration,
         lessons.video_type,
         CASE 
      WHEN chapters.sequence = 1 THEN lessons.video_url 
      ELSE NULL 
    END AS video_url,
     CASE 
        WHEN chapters.sequence = 1 THEN lessons.thumbnail 
        ELSE NULL 
    END AS thumbnail,
         chapter_id,
         lessons.id AS lesson_id,
         chapters.sequence as chapter_no,
         lessons.sequence as lesson_no
         FROM 
    courses
JOIN 
    chapters ON chapters.course_id = courses.id
  JOIN lessons ON lessons.chapter_id = chapters.id 
  WHERE chapters.course_id = ? AND courses.expert_id=?
  ORDER BY chapters.sequence, lessons.sequence
`;
  const [rows] = await pool.query(query, [id, expert]);

  // let totalLessons = 0;

  const groupedResults = rows.reduce((acc, row) => {
    const {
      chapter_id,
      chapterTitle,
      lessonTitle,
      duration,
      lesson_id,
      video_url,
      lesson_no,
      chapter_no,
      thumbnail,
      video_type,
    } = row;

    let chapter = acc.find((ch) => ch.chapter_id === chapter_id);
    if (!chapter) {
      chapter = {
        chapter_id,
        chapterTitle,
        chapter_no,
        totalDuration: 0,
        totalLessons: 0,
        lessons: [],
      };
      acc.push(chapter);
    }

    let finalVideoUrl = null;
    if (chapter_no === 1) {
      if (video_type === "youtube" || video_type === "vimeo") {
        finalVideoUrl = video_url;
      } else {
        finalVideoUrl = video_url;
      }
    }

    chapter.lessons.push({
      lesson_id,
      lessonTitle,
      duration,
      video_url: finalVideoUrl,
      video_type,
      lesson_no,
      thumbnail,
    });

    chapter.totalDuration += parseInt(duration, 10);
    chapter.totalLessons += 1;

    return acc;
  }, []);

  const total_chapters = groupedResults.length;

  return {
    chapters: groupedResults,
    total_chapters,
  };
});

exports.getExpertsAllCourses = asyncChoke(async (id, search, tab) => {
  let partialQuery = ``;
  let searchQuery = ``;

  if (search) searchQuery = `and title LIKE ? OR categories.name LIKE ?`;
  if (tab === "live") partialQuery = `and courses.status="approved"`;
  if (tab === "requested") partialQuery = `and courses.status="requested"`;
  if (tab === "declined") partialQuery = `and courses.status="declined"`;
  if (tab === "incomplete") partialQuery = `and courses.status="published"`;
  const query = `
    WITH LatestRemarks AS (
    SELECT 
        rr.remarks,
        rr.course_id,
        ROW_NUMBER() OVER(PARTITION BY rr.course_id ORDER BY rr.created_at DESC) AS row_num
    FROM 
        review_requests rr
)
SELECT 
    courses.id,
    courses.title,
    courses.description,
    users.name AS expert_name,
    courses.thumbnail,
    courses.price,
    courses.discount,
    categories.name AS category,
    LatestRemarks.remarks,
    FLOOR(courses.price - (courses.price * courses.discount / 100)) AS discounted_price
FROM 
    courses
JOIN 
    users ON courses.expert_id = users.id
JOIN 
    categories ON courses.category_id = categories.id
LEFT JOIN 
    LatestRemarks ON LatestRemarks.course_id = courses.id AND LatestRemarks.row_num = 1
WHERE 
    courses.expert_id = ?
      ${partialQuery}
      ${searchQuery}
      `;
  const [result] = await pool.query(query, [id, `%${search}%`, `%${search}%`]);

  return result;
});

exports.getRemarks = asyncChoke(async (req, res, next) => {
  const { course_id } = req.params;
  const query = `select remarks from review_requests where course_id=?
   ORDER BY created_at DESC limit 1 `;
  const [result] = await pool.query(query, [course_id]);

  res.status(200).json({
    message: "Success",
    remarks: result[0].remarks,
  });
});

exports.createCourse = asyncChoke(async (req, res, next) => {
  const { title, description, price, category_id, discount, access, tag_ids } =
    req.body;
  const { id } = req.user;
  const image = req.files;
  let thumbnailUrl;

  const [category] = await pool.query(`select * from categories where id=?`, [
    category_id,
  ]);

  if (category[0]?.parent_id === null)
    return next(new AppError(400, "please select valid category"));

  if (discount > 50)
    return next(new AppError(400, "discount cannot be greater than 50"));

  if (image.thumbnail) {
    thumbnailUrl = await uploadFile(image.thumbnail);
  }

  const course = await create("courses", {
    title,
    description,
    price,
    category_id,
    expert_id: id,
    status: "published",
    access,
    discount,
    thumbnail: thumbnailUrl,
  });
  const course_id = course.insertId;
  // const parsedTagIds = JSON.parse(tag_ids);

  // parsedTagIds.forEach(async (tag_id) => {
  tag_ids.forEach(async (tag_id) => {
    await create("course_tags", {
      course_id,
      tag_id,
    });
  });

  res.status(200).json({
    message: "Success",
    data: {
      course_id,
      title,
    },
  });
});

exports.updateCourse = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const image = req.files;
  let thumbnailUrl;
  const { title, description, price, category_id, discount, access, tag_ids } =
    req.body;

  if (discount > 100)
    return next(new AppError(400, "discount cannot be greater than 100"));

  if (image.thumbnail) {
    thumbnailUrl = await uploadFile(image.thumbnail);
    await findAndUpdate("courses", { thumbnail: thumbnailUrl }, { id });
  }

  const [results] = await findAndUpdate(
    "courses",
    {
      title,
      description,
      price,
      category_id,
      // status,
      discount,
      access,
    },
    { id }
  );
  if (tag_ids) {
    await pool.query("DELETE FROM course_tags WHERE course_id = ?", [id]);
    // const parsedTagIds = JSON.parse(tag_ids);
    // parsedTagIds.forEach(async (tag_id) => {
    tag_ids.forEach(async (tag_id) => {
      await create("course_tags", {
        course_id: id,
        tag_id,
      });
    });
  }

  if (results.affectedRows === 0)
    return next(new AppError(404, "no course found with this id"));

  res.status(200).json({
    status: "Success",
  });
});

exports.deleteCourse = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const query = `delete from courses where id=?`;
  await pool.query(query, [id]);

  res.status(200).json({
    status: "Success",
  });
});

exports.getAllCourses = asyncChoke(async (req, res, next) => {
  let token;
  let { category, search } = req.query;
  let searchCondition = ``;
  let categoryCondition = ``;
  let conditions = [];
  let values = [];

  // Handle search condition
  if (search) {
    searchCondition = `(courses.title LIKE ? OR categories.name LIKE ?)`;
    conditions.push(searchCondition);
    values.push(`%${search}%`, `%${search}%`);
  }

  // Handle category condition
  if (category) {
    categoryCondition = `categories.name = ?`;
    conditions.push(categoryCondition);
    values.push(category);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let rows;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.JWT) {
    token = req.cookies.JWT;
  }
  const cookies = token;

  if (!cookies) {
    const query = `SELECT
      courses.id,
      courses.title,
      courses.description,
      users.profile_picture AS expert_profile,
      users.name AS expert,
      users.id AS expert_id,
      courses.thumbnail,
      price,
      discount,
      floor(price - (price * discount / 100)) AS discounted_price,
      categories.name AS category,
      GROUP_CONCAT(distinct tags.name ORDER BY tags.name ASC SEPARATOR ', ') AS tags,
      (
      SELECT lessons.video_url
      FROM chapters
      JOIN lessons ON lessons.chapter_id = chapters.id
      WHERE chapters.course_id = courses.id
      ORDER BY chapters.id ASC, lessons.id ASC
      LIMIT 1
    ) AS first_lesson_video_url
    FROM
      courses
    JOIN
      users ON courses.expert_id = users.id
    JOIN
      categories ON courses.category_id = categories.id
    LEFT JOIN
      course_tags ON course_tags.course_id = courses.id
    LEFT JOIN
      tags ON tags.id = course_tags.tag_id
    JOIN
      chapters ON chapters.course_id = courses.id
    JOIN
      lessons ON lessons.chapter_id = chapters.id
    ${whereClause} AND courses.status="approved"
    GROUP BY courses.id`;

    [rows] = await pool.query(query, values);

    if (rows.length === 0) return next(new AppError(404, "No courses found"));
  } else {
    const { email } = jwt.verify(cookies, process.env.JWT_SECRET);

    const query1 = `SELECT id, user_type, email FROM users WHERE email=?`;
    const [results] = await pool.query(query1, [email]);
    const user = results[0];

    const query = `SELECT
      courses.id,
      courses.title,
      courses.description,
      users.name AS expert,
            users.profile_picture AS expert_profile,

       users.id AS expert_id,
      courses.thumbnail,
      price,
      discount,
      floor(price - (price * discount / 100)) AS discounted_price,
      categories.name AS category,
      GROUP_CONCAT(distinct tags.name ORDER BY tags.name ASC SEPARATOR ', ') AS tags,
      IF(users_courses.user_id IS NOT NULL, 1, 0) AS is_purchased,
      IF(favourite_courses.user_id IS NOT NULL, 1, 0) AS is_favourite,
      (
      SELECT lessons.video_url
      FROM chapters
      JOIN lessons ON lessons.chapter_id = chapters.id
      WHERE chapters.course_id = courses.id
      ORDER BY chapters.id ASC, lessons.id ASC
      LIMIT 1
    ) AS first_lesson_video_url
    FROM
      courses
    JOIN
      users ON courses.expert_id = users.id
    JOIN
      categories ON courses.category_id = categories.id
    LEFT JOIN
      course_tags ON course_tags.course_id = courses.id
    LEFT JOIN
      tags ON tags.id = course_tags.tag_id
    LEFT JOIN
      users_courses ON users_courses.course_id = courses.id AND users_courses.user_id = ?
    LEFT JOIN
      cart ON cart.course_id = courses.id AND cart.user_id = ?
    LEFT JOIN
      favourite_courses ON favourite_courses.course_id = courses.id AND favourite_courses.user_id = ?
    JOIN
      chapters ON chapters.course_id = courses.id
    JOIN
      lessons ON lessons.chapter_id = chapters.id
    ${whereClause} AND courses.status="approved"
    GROUP BY courses.id`;

    [rows] = await pool.query(query, [user.id, user.id, user.id, ...values]);

    if (rows.length === 0) return next(new AppError(404, "No courses found"));
  }

  res.status(200).json({
    status: "Success",
    data: rows,
  });
});

exports.getCoursesOfExpert = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  let { search, tab } = req.query;
  if (!search) search = "";
  tab = tab || "live";

  const result = await this.getExpertsAllCourses(id, search, tab);
  if (result.length === 0) return next(new AppError(404, "no courses found"));

  res.status(200).json({
    status: "Success",
    data: result,
  });
});

//course by id
exports.getCourseById = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  let expert_id;
  if (req.user.user_type === "expert") expert_id = req.user.id;

  if (req.user.user_type === "admin") {
    const q = `select expert_id from courses where id=?`;
    const [expert] = await pool.query(q, [id]);
    expert_id = expert[0].expert_id;
  }

  const query = `
    SELECT 
        courses.id,
        expert_id,
        title,
        access,
        price,
        discount,
        courses.status,
        courses.description,
        profiles.bio,
        profiles.social_media_links,
        profiles.website,
        users.name,
        users.profile_picture,
        users.id AS expert_id,
        floor(price - (price * discount / 100)) AS discounted_price,
        thumbnail,total_duration,
        ROUND(total_duration / 60 ) AS duration_in_hours,
         categories.id AS category_id,
        GROUP_CONCAT(tags.id ORDER BY tags.id ASC SEPARATOR ', ') AS tag_ids,
       (SELECT COUNT(*) 
     FROM lessons 
     JOIN chapters ON lessons.chapter_id = chapters.id 
     WHERE chapters.course_id = courses.id) AS total_lesson
    FROM 
        courses 
    JOIN 
        users ON courses.expert_id = users.id
        JOIN 
        profiles ON profiles.user_id = users.id
    JOIN
        categories ON courses.category_id = categories.id 
    LEFT JOIN 
        course_tags ON course_tags.course_id = courses.id 
    LEFT JOIN 
        tags ON tags.id = course_tags.tag_id 
    WHERE 
        courses.id = ? AND courses.expert_id=?
  `;

  let [result] = await pool.query(query, [id, expert_id]);

  if (result[0].id === null)
    return next(new AppError(404, "No course found with this id"));
  result[0].coins = result[0].discounted_price / process.env.POINT;

  if (result[0].tag_ids)
    result[0].tag_ids = result[0].tag_ids.split(",").map(Number);

  res.status(200).json({
    status: "Success",
    data: result,
  });
});

exports.getCourseOverview = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  let data;

  if (req.user.user_type === "expert")
    data = await getCourseContent(req.user.id, id, req.user.id);

  if (req.user.user_type === "admin") {
    const query = `select expert_id from courses where id =?`;
    const [value] = await pool.query(query, [id]);
    data = await getCourseContent(value[0].expert_id, id, value[0].expert_id);
  }

  res.status(200).json({
    status: "Success",
    data,
  });
});

exports.getUserCourseOverview = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  // const [bio] = await pool.query(`select * from profiles where user_id = ?`, [id]);
  const query = `SELECT 
    courses.id,
    title,
    ANY_VALUE(users_courses.completion_percentage) AS completion_percentage,
    courses.description,
    users.name,
    ANY_VALUE(users.id) AS expert_id,
    profile_picture,
    thumbnail,
    price,
    expert_id,
    ANY_VALUE(profiles.bio) AS bio,
    profiles.social_media_links,
    profiles.website,
    discount,
    FLOOR(price - (price * discount / 100)) AS discounted_price,
    access,
    enrolled,
    courses.updated_at,
    total_duration,
    categories.name AS category,
    IF(users_courses.user_id IS NOT NULL, 1, 0) AS is_purchased,
    IF(cart.user_id IS NOT NULL, 1, 0) AS is_in_cart,
    IF(favourite_courses.user_id IS NOT NULL, 1, 0) AS is_favourite,
    GROUP_CONCAT(tags.name ORDER BY tags.name ASC SEPARATOR ', ') AS tags,
    COALESCE(p.lessons_completed, 0) AS lessons_completed,
    COALESCE(lc.total_lessons, 0) AS total_lessons,
    rating, comment, reviews.id AS review_id,
    IF(reviews.user_id IS NOT NULL, 1, 0) AS is_rated
FROM 
    courses 
JOIN 
    users ON courses.expert_id = users.id
JOIN 
    profiles ON profiles.user_id = users.id
JOIN
    categories ON courses.category_id = categories.id 
LEFT JOIN 
    course_tags ON course_tags.course_id = courses.id 
LEFT JOIN 
    tags ON tags.id = course_tags.tag_id 
LEFT JOIN 
    users_courses ON users_courses.course_id = courses.id AND users_courses.user_id = ?
LEFT JOIN 
    cart ON cart.course_id = courses.id AND cart.user_id = ?
LEFT JOIN
    favourite_courses ON favourite_courses.course_id = courses.id AND favourite_courses.user_id = ?
LEFT JOIN 
    (SELECT 
         uc.course_id,
         COUNT(DISTINCT lp.lesson_id) AS lessons_completed
     FROM 
         users_courses uc
     LEFT JOIN 
         user_progress lp ON lp.course_id = uc.course_id AND lp.user_id = uc.user_id AND lp.completed = 1
     WHERE
         uc.user_id = ? 
     GROUP BY 
         uc.course_id) p ON p.course_id = courses.id
LEFT JOIN 
    (SELECT 
         c.id AS course_id,
         COUNT(DISTINCT l.id) AS total_lessons
     FROM 
         courses c
     LEFT JOIN 
         chapters ch ON ch.course_id = c.id
     LEFT JOIN 
         lessons l ON l.chapter_id = ch.id
     GROUP BY 
         c.id) lc ON lc.course_id = courses.id
LEFT JOIN 
    reviews ON reviews.course_id = courses.id AND reviews.user_id = ? 
WHERE
    courses.id = ?;

`;
  const [result] = await pool.query(query, [
    req.user.id,
    req.user.id,
    req.user.id,
    req.user.id,
    req.user.id,
    id,
  ]);

  if (result[0].id === null)
    return next(new AppError(404, "No course found with this id"));

  result[0].coins = result[0].discounted_price / process.env.POINT;

  const course = `select id from users_courses where course_id=? And user_id=?`;
  const [users_courses] = await pool.query(course, [id, req.user.id]);
  let courseChapters;

  if (users_courses.length === 0) {
    courseChapters = await getCourseContentWithotPurchase(
      id,
      result[0].expert_id
    );
  } else {
    courseChapters = await getCourseContent(
      req.user.id,
      id,
      result[0].expert_id
    );
  }

  const reviews = await calculateRating(id);
  const review = {
    totalReviews: reviews.totalReviews,
    averageRating: reviews.averageRating,
    userReviews: reviews.rows,
  };
// console.log("am i?");
  res.status(200).json({
    status: "Success",
    data: {
      // bio: bio[0],
      course: result[0],
      courseChapters,
      review,
    },
  });
});

exports.getUserCourseOverviewWithoutPuchase = asyncChoke(
  async (req, res, next) => {
    const { id } = req.params;
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    )
      token = req.headers.authorization.split(" ")[1];
    else if (req.cookies.JWT) token = req.cookies.JWT;

    const cookies = token;
    let favouriteQuery = ``;
    let is_favourite = `0 AS is_favourite`;
    let user;
    if (cookies) {
      const { email } = jwt.verify(cookies, process.env.JWT_SECRET);

      const query1 = `SELECT id, user_type, email FROM users  WHERE email=?`;

      const [results] = await pool.query(query1, [email]);

      user = results[0];

      is_favourite = `If(favourite_courses.user_id IS NOT NULL ,1,0)AS is_favourite`;
      favouriteQuery = `LEFT JOIN
    favourite_courses ON favourite_courses.course_id=courses.id 
    AND favourite_courses.user_id = ${user.id}`;
    }

    const query = `SELECT 
    courses.id,
    title,
    courses.description,
    users.name,
    users.id AS expert_id,
    profile_picture,
    users.id AS expert_id,
    thumbnail,
    price,
    profiles.bio,
    profiles.social_media_links,
    profiles.website,
    expert_id,
    discount,
    floor(price - (price * discount / 100)) AS discounted_price,
    access,
    enrolled,
    courses.updated_at,
    total_duration,
    categories.name AS category,
    GROUP_CONCAT(DISTINCT tags.name ORDER BY tags.name ASC SEPARATOR ', ') AS tags,
    ${is_favourite}
FROM 
    courses 
JOIN 
    users ON courses.expert_id = users.id
    JOIN
    profiles ON profiles.user_id = users.id
JOIN 
    categories ON courses.category_id = categories.id 
LEFT JOIN 
    course_tags ON course_tags.course_id = courses.id 
LEFT JOIN 
    tags ON tags.id = course_tags.tag_id 
    ${favouriteQuery}
WHERE
    courses.id = ?
`;
    const [result] = await pool.query(query, [id]);

    if (result[0].id === null)
      return next(new AppError(404, "No course found with this id"));

    result[0].coins = result[0].discounted_price / process.env.POINT;

    const courseChapters = await getCourseContentWithotPurchase(
      id,
      result[0].expert_id
    );

    const reviews = await calculateRating(id);
    const review = {
      totalReviews: reviews.totalReviews,
      averageRating: reviews.averageRating,
      userReviews: reviews.rows,
    };
    let expertCourses;
    if (!cookies) {
      const allCourses = `SELECT 
    courses.id,
    courses.title,
    courses.description,
    users.name,
     users.id AS expert_id,
    courses.thumbnail,
    courses.price,
    courses.discount,
    categories.name AS category,
    floor(courses.price - (courses.price * courses.discount / 100)) AS discounted_price,
     GROUP_CONCAT(DISTINCT tags.name ORDER BY tags.name ASC SEPARATOR ', ') AS tags
FROM 
    courses 
JOIN 
    users ON courses.expert_id = users.id
JOIN 
    categories ON courses.category_id = categories.id 
LEFT JOIN 
    course_tags ON course_tags.course_id = courses.id 
LEFT JOIN 
    tags ON tags.id = course_tags.tag_id 
WHERE 
    courses.expert_id = ? 
    AND courses.id != ?
    AND courses.status="approved"
GROUP BY courses.id
`;
      [expertCourses] = await pool.query(allCourses, [
        result[0].expert_id,
        result[0].id,
      ]);
    } else {
      const allCourses = `SELECT 
      courses.id,
      courses.title,
      courses.description,
      users.name,
       users.id AS expert_id,
      courses.thumbnail,
      courses.price,
      courses.discount,
      categories.name AS category,
      floor(courses.price - (courses.price * courses.discount / 100)) AS discounted_price,
      IF(users_courses.user_id IS NOT NULL, 1, 0) AS is_purchased,
     IF(cart.user_id IS NOT NULL, 1, 0) AS is_in_cart,
     If(favourite_courses.user_id IS NOT NULL ,1,0)AS is_favourite,
       GROUP_CONCAT(DISTINCT tags.name ORDER BY tags.name ASC SEPARATOR ', ') AS tags
  FROM 
      courses 
  JOIN 
      users ON courses.expert_id = users.id
  JOIN 
      categories ON courses.category_id = categories.id 
  LEFT JOIN 
      course_tags ON course_tags.course_id = courses.id 
  LEFT JOIN 
      tags ON tags.id = course_tags.tag_id 
  LEFT JOIN 
    users_courses ON users_courses.course_id = courses.id AND users_courses.user_id = ?
  LEFT JOIN 
    cart ON cart.course_id = courses.id AND cart.user_id = ?
 LEFT JOIN
    favourite_courses ON favourite_courses.course_id=courses.id AND favourite_courses.user_id = ?
  WHERE 
      courses.expert_id = ? 
      AND courses.id != ?
      AND courses.status="approved"
  GROUP BY courses.id
  `;
      [expertCourses] = await pool.query(allCourses, [
        user.id,
        user.id,
        user.id,
        result[0].expert_id,
        result[0].id,
      ]);
    }

    res.status(200).json({
      status: "Success",
      data: {
        course: result[0],
        courseChapters,
        review,
        other_courses: expertCourses,
      },
    });
  }
);

exports.searchCourses = asyncChoke(async (req, res, next) => {
  const { search } = req.query;
  const query = `
      SELECT * FROM courses join category
      WHERE title LIKE ? 
    `;

  const [result] = await pool.query(query, [`%${search}%`]);
});

// Stream the video using token validation
exports.videoStream = asyncChoke(async (req, res) => {
  const lessonId = req.params.lessonId;

  try {
    const [video] = await pool.query(
      "SELECT video_url FROM lessons WHERE id = ?",
      [lessonId]
    );
    const s3Key = video[0].video_url;

    const headParams = {
      Bucket: "rb-screenshots-actwin",
      Key: "videos/video-1725901065380.mp4",
    };

    // const headCommand = new HeadObjectCommand(headParams);

    // const headData = await s3.send(headCommand);

    // const range = req.headers.range;
    // console.log(range);
    // if (!range) {
    //   res.status(416).send("Requires Range header");
    //   return;
    // }

    // const videoSize = headData.ContentLength;
    // const CHUNK_SIZE = 10 ** 6; // 1MB per chunk
    // const start = Number(range.replace(/\D/g, ""));
    // const end = Math.min(start + CHUNK_SIZE, videoSize - 1);
    // const CHUNK_SIZE = 10 ** 6; // 1MB per chunk
    // const [start, end] = range.replace(/bytes=/, "").split("-");
    // const startByte = parseInt(start, 10);
    // const endByte = end
    //   ? parseInt(end, 10)
    //   : Math.min(startByte + CHUNK_SIZE - 1, videoSize - 1);

    // const contentLength = end - start + 1;
    // const contentLength = endByte - startByte + 1;
    // const headers = {
    //   "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    //   "Accept-Ranges": "bytes",
    //   "Content-Length": contentLength,
    //   "Content-Type": headData.ContentType,
    // };

    // res.writeHead(206, headers);
    // console.log(start);

    // Get the video stream from S3
    // const getParams = {
    //   Bucket: "rb-screenshots-actwin", // Replace with your S3 bucket name
    //   Key: "videos/video-1725901065380.mp4",
    //   Range: `bytes=${start}-${end}`,
    // };
    // console.log(getParams);

    const data = await s3.send(new GetObjectCommand(headParams));
    res.setHeader("Content-Type", "video/mp4");
    data.Body.pipe(res); // Stream the video to the response

    // const getCommand = new GetObjectCommand(getParams);
    // const { Body: videoStream } = await s3.send(getCommand);
    // videoStream.pipe(res);
  } catch (err) {
    console.error("Error retrieving video:", err);
    res.status(500).send("Error retrieving video");
  }
});

exports.favouriteCourse = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { course_id } = req.params;
  
  const query = `select * from favourite_courses where user_id=? and course_id=?  `;
  const [result] = await pool.query(query, [id, course_id]);

  if (result.length === 0) {
    const favourite = await create("favourite_courses", {
      user_id: id,
      course_id,
    });
  } else {
    const deleteQuery = `delete from favourite_courses where user_id=? and course_id=? `;
    await pool.query(deleteQuery, [id, course_id]);
  }
  res.status(200).json({
    status: "Success",
  });
});
