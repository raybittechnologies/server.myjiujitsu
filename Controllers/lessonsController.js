const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { uploadProfile, uploadFile } = require("../Utils/uploadProfile");
const {
  create,
  find,
  findAndUpdate,
  findMany,
  findById,
  findOne,
} = require("./handlerFactory");

const generateUniqueString = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const length = 20;

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
};

exports.createLesson = asyncChoke(async (req, res, next) => {
  let {
    course_id,
    chapter_id,
    title,
    video_url,
    text_content,
    duration,
    video_type,
  } = req.body;

  const files = req.files;

  let thumbnailUrl;

  if (files.thumbnail) {
    thumbnailUrl = await uploadFile(files.thumbnail);
  }

  const query = `SELECT lessons.sequence FROM lessons join chapters
  on lessons.chapter_id=chapters.id JOIN courses ON chapters.course_id=courses.id
   WHERE course_id = ? 
   ORDER BY sequence DESC 
   LIMIT 1; `;
  const [previousLesson] = await pool.query(query, [course_id]);

  let sequence;
  if (previousLesson.length === 0) sequence = 1;
  else sequence = previousLesson[0].sequence + 1;

  if (video_type === "local" && files.video_url) {
    video_url = await uploadFile(files.video_url);
  }

  const result = await create("lessons", {
    chapter_id,
    title,
    video_url,
    text_content,
    duration,
    video_type,
    sequence,
    thumbnail: thumbnailUrl,
  });

  const courseduration = `update courses set total_duration=total_duration+${duration}
  where id=?`;
  await pool.query(courseduration, [course_id]);

  res.status(200).json({
    status: "success",
    message: "lesson added successfully",
  });
});

exports.getAllLessons = asyncChoke(async (req, res, next) => {
  const [lessons] = await find("lessons");

  if (lessons.length === 0) {
    return next(new AppError(404, "no lessons found"));
  }
  res.status(200).json({
    status: "success",
    data: lessons,
  });
});

exports.getLessonsOfChapter = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const [lessons] = await findMany("lessons", { chapter_id: id });

  if (lessons.length === 0) {
    return next(new AppError(404, "no lessons found"));
  }
  res.status(200).json({
    status: "success",
    data: lessons,
  });
});

exports.updateLesson = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { title, video_url, text_content, duration, video_type, course_id } =
    req.body;
  const image = req.files;
  let thumbnailUrl;

  const [rows] = await pool.query("SELECT * FROM lessons WHERE id = ?", [id]);

  if (rows.length === 0) {
    return next(new AppError(404, "Lesson not found"));
  }
  if (image.thumbnail) {
    thumbnailUrl = await uploadProfile(image.thumbnail);
    await findAndUpdate("lessons", { thumbnail: thumbnailUrl }, { id });
  }

  const previousDuration = rows[0].duration;

  await findAndUpdate(
    "lessons",
    {
      title,
      video_url,
      text_content,
      duration,
      video_type,
    },
    { id }
  );

  const courseDurationUpdateQuery = `
    UPDATE courses
    SET total_duration = total_duration - ? + ?
    WHERE id = ?;
  `;
  await pool.query(courseDurationUpdateQuery, [
    previousDuration,
    duration,
    course_id,
  ]);

  res.status(200).json({
    status: "success",
    message: "Lesson updated successfully",
  });
});

exports.deleteLesson = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { course_id } = req.body;

  const [lesson] = await findById("lessons", id);
  if (!lesson) return next(new AppError(404, "no lesson found by this id"));

  await pool.query(`delete from lessons where id =?`, [id]);

  const courseDurationUpdateQuery = `
    UPDATE courses
    SET total_duration = total_duration - ?
    WHERE id = ?;
  `;
  await pool.query(courseDurationUpdateQuery, [lesson.duration, course_id]);

  const swapSequenceQuery = `SELECT lessons.id FROM lessons 
    JOIN chapters ON lessons.chapter_id = chapters.id
    JOIN courses ON chapters.course_id = courses.id
    WHERE lessons.sequence > ?
    AND courses.id = ?
    order by lessons.sequence 
    ;`;

  const [swapped] = await pool.query(swapSequenceQuery, [
    lesson.sequence,
    course_id,
  ]);

  if (swapped.length > 0) {
    const ids = swapped.map((row) => row.id);

    const query = `
      UPDATE lessons 
      SET sequence = sequence - 1 
      WHERE id IN (${ids.join(", ")});
    `;

    await pool.query(query);
  }

  res.status(200).json({
    status: "success",
    message: "Lesson deleted successfully",
  });
});

// change sequence of lessons
exports.changeLessonSequence = asyncChoke(async (req, res, next) => {
  const {
    swapSequence,
    swapWithSequence,
    course_id,
    chapter_id_from,
    chapter_id_to,
  } = req.body;

  if (swapSequence === undefined || swapSequence === swapWithSequence) {
    return next(
      new AppError(402, "Provide the correct sequences to be swapped")
    );
  }

  let newSequence, lastSequence;
  let targetChapterLessons = [];

  if (swapWithSequence === undefined) {
    const direction = chapter_id_from > chapter_id_to ? -1 : 1;

    const prevChapterQuery = `
    SELECT id 
    FROM chapters 
    WHERE course_id = ? 
    AND sequence < (
      SELECT sequence 
      FROM chapters 
      WHERE id = ?
      )
      ORDER BY sequence DESC 
      LIMIT 1;`;

    const [prevChapter] = await pool.query(prevChapterQuery, [
      course_id,
      chapter_id_to,
    ]);
    const prevChapterId = prevChapter.length ? prevChapter[0].id : null;

    if (!prevChapterId) {
      lastSequence = 0;
      const swapAlpha = direction > 0 ? swapSequence : lastSequence;
      const swapBeta = direction > 0 ? lastSequence : swapSequence;

      const swapSequenceQuery = `
        SELECT lessons.id 
        FROM lessons 
        JOIN chapters ON lessons.chapter_id = chapters.id
        WHERE lessons.sequence >= ?
        AND lessons.sequence <= ?  
        AND chapters.course_id = ?
        ORDER BY lessons.sequence;`;

      [targetChapterLessons] = await pool.query(swapSequenceQuery, [
        swapAlpha,
        swapBeta,
        course_id,
      ]);
    } else {
      const lastLessonQuery = `
        SELECT sequence 
        FROM lessons 
        WHERE chapter_id = ? 
        ORDER BY sequence DESC 
        LIMIT 1;`;

      const [lastLesson] = await pool.query(lastLessonQuery, [prevChapterId]);
      lastSequence = lastLesson.length ? lastLesson[0].sequence : null;

      if (!lastSequence) {
        throw new Error("No lessons found in the previous chapter.");
      }

      const swapAlpha = direction > 0 ? swapSequence : lastSequence;
      const swapBeta = direction > 0 ? lastSequence : swapSequence;

      const swapSequenceQuery = `
      SELECT lessons.id 
      FROM lessons 
      JOIN chapters ON lessons.chapter_id = chapters.id
      WHERE lessons.sequence >= ?
      AND lessons.sequence <= ?  
      AND chapters.course_id = ?
      ORDER BY lessons.sequence;`;

      [targetChapterLessons] = await pool.query(swapSequenceQuery, [
        swapAlpha,
        swapBeta,
        course_id,
      ]);
    }
    newSequence = lastSequence;

    if (direction > 0) {
      const UPDATE_SEQUENCE = `
          UPDATE lessons
          JOIN chapters ON lessons.chapter_id = chapters.id
          SET lessons.sequence = lessons.sequence - 1
          WHERE lessons.sequence <= ?
          AND lessons.sequence > ?
          AND chapters.course_id = ?;
        `;
      await pool.query(UPDATE_SEQUENCE, [
        lastSequence,
        swapSequence,
        course_id,
      ]);
      await pool.query(
        `UPDATE lessons SET sequence = ?, chapter_id = ? WHERE id = ?`,
        [newSequence, chapter_id_to, targetChapterLessons[0].id]
      );
    } else {
      const UPDATE_SEQUENCE = `
          UPDATE lessons
          JOIN chapters ON lessons.chapter_id = chapters.id
          SET lessons.sequence = lessons.sequence + 1
          WHERE lessons.sequence > ?
          AND lessons.sequence < ?
          AND chapters.course_id = ?;
        `;
      await pool.query(UPDATE_SEQUENCE, [
        lastSequence,
        swapSequence,
        course_id,
      ]);
      await pool.query(
        `UPDATE lessons SET sequence = ?, chapter_id = ? WHERE id = ?`,
        [
          newSequence + 1,
          chapter_id_to,
          targetChapterLessons[targetChapterLessons.length - 1].id,
        ]
      );
    }
  } else {
    const direction = swapSequence > swapWithSequence ? -1 : 1;
    const swapAlpha = direction > 0 ? swapSequence : swapWithSequence;
    const swapBeta = direction > 0 ? swapWithSequence : swapSequence;

    const swapSequenceQuery = `SELECT lessons.id FROM lessons
      JOIN chapters ON lessons.chapter_id = chapters.id
      WHERE lessons.sequence >= ?
      AND lessons.sequence <= ?
      AND chapters.course_id = ?
      ORDER BY lessons.sequence;`;
    [targetChapterLessons] = await pool.query(swapSequenceQuery, [
      swapAlpha,
      swapBeta,
      course_id,
    ]);
    if (!targetChapterLessons.length) {
      return next(new AppError(404, "No lessons found to swap"));
    }
    newSequence = swapWithSequence;

    if (direction > 0) {
      const UPDATE_SEQUENCE = `
        UPDATE lessons
        JOIN chapters ON lessons.chapter_id = chapters.id
        SET lessons.sequence = lessons.sequence - 1
        WHERE lessons.sequence > ?
        AND lessons.sequence <= ?
        AND chapters.course_id = ?;
      `;
      await pool.query(UPDATE_SEQUENCE, [swapAlpha, swapBeta, course_id]);
      await pool.query(
        `UPDATE lessons SET sequence = ?, chapter_id = ? WHERE id = ?`,
        [newSequence, chapter_id_to, targetChapterLessons[0].id]
      );
    } else {
      const UPDATE_SEQUENCE = `
        UPDATE lessons
        JOIN chapters ON lessons.chapter_id = chapters.id
        SET lessons.sequence = lessons.sequence + 1
        WHERE lessons.sequence >= ?
        AND lessons.sequence < ?
        AND chapters.course_id = ?;
      `;
      await pool.query(UPDATE_SEQUENCE, [swapAlpha, swapBeta, course_id]);
      await pool.query(
        `UPDATE lessons SET sequence = ?, chapter_id = ? WHERE id = ?`,
        [
          newSequence,
          chapter_id_to,
          targetChapterLessons[targetChapterLessons.length - 1].id,
        ]
      );
    }
  }

  res.status(200).json({
    status: "Success",
    updatedLesson: swapSequence,
    targetChapterLessons,
  });
});

exports.markLessonAsRead = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { course_id, lesson_id } = req.body;

  // Check if the lesson is already marked as completed
  const query = `SELECT * FROM user_progress WHERE user_id=? AND course_id=? AND lesson_id=?`;
  const [readLesson] = await pool.query(query, [id, course_id, lesson_id]);

  // If the lesson is not in user_progress, add it as completed
  if (readLesson.length === 0) {
    await create("user_progress", {
      user_id: id,
      course_id,
      lesson_id,
      completed: true,
    });
  } 
  // If the lesson is in user_progress but not completed, mark it as completed
  else if (readLesson[0].completed === 0) {
    const update = `UPDATE user_progress SET completed=true WHERE user_id=? AND course_id=? AND lesson_id=?`;
    await pool.query(update, [id, course_id, lesson_id]);
  }

  // Update completion percentage
  const completionQuery = `SELECT completion_percentage FROM users_courses WHERE user_id=? AND course_id=?`;
  const [completion] = await pool.query(completionQuery, [id, course_id]);

  if (completion[0].completion_percentage < 100) {
    const query2 = `UPDATE users_courses uc
    JOIN (
      SELECT
        COUNT(CASE WHEN up.completed = true THEN 1 ELSE NULL END) AS watched_lessons,
        (
          SELECT COUNT(l.id)
          FROM lessons l
          JOIN chapters c ON l.chapter_id = c.id
          WHERE c.course_id = ?
        ) AS total_lessons
      FROM user_progress up
      WHERE up.user_id = ? AND up.course_id = ?
    ) AS lesson_data
    ON uc.user_id = ? AND uc.course_id = ?
    SET uc.completion_percentage = (lesson_data.watched_lessons * 100.0 / lesson_data.total_lessons),
    uc.updated_at = NOW();`;

    await pool.query(query2, [course_id, id, course_id, id, course_id]);
  } 

  // Check for certificate
  if (completion[0].completion_percentage === 100) {
    const certificateQuery = `SELECT * FROM certificates WHERE user_id=? AND course_id=?`;
    const [userCertificate] = await pool.query(certificateQuery, [id, course_id]);

    if (userCertificate.length === 0) {
      const certificate_id = generateUniqueString();
      await create("certificates", { certificate_id, user_id: id, course_id });
    }
  }

  res.status(200).json({
    status: "Success",
    message: "Lesson marked as completed",
  });
});
