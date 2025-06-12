const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const { find, create, findAndUpdate, findMany } = require("./handlerFactory");

exports.createChapter = asyncChoke(async (req, res, next) => {
  const { course_id, title } = req.body;

  const query = `SELECT sequence FROM chapters 
   WHERE course_id = ? 
   ORDER BY sequence DESC 
   LIMIT 1; `;
  const [previousChapter] = await pool.query(query, [course_id]);
  let sequence;
  if (previousChapter.length === 0) sequence = 1;
  else sequence = previousChapter[0].sequence + 1;

  const results = await create("chapters", { course_id, title, sequence });

  res.status(200).json({
    status: "success",
    message: "chapter created successfully",
  });
});

exports.getChaptersOfCourse = asyncChoke(async (req, res, next) => {
  const { course_id } = req.params;

  // Fetch chapters ordered by sequence
  const [chapters] = await pool.query(
    "SELECT * FROM chapters WHERE course_id = ? ORDER BY sequence",
    [course_id]
  );

  if (chapters.length === 0) {
    return next(new AppError(404, "No chapters found"));
  }

  // Fetch lessons for each chapter in order
  const chaptersWithLessons = await Promise.all(
    chapters.map(async (chapter) => {
      const [lessons] = await pool.query(
        "SELECT * FROM lessons WHERE chapter_id = ? ORDER BY sequence",
        [chapter.id]
      );
      return { ...chapter, lessons };
    })
  );

  res.status(200).json({
    status: "success",
    data: chaptersWithLessons,
  });
});


exports.updateChapter = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { title } = req.body;
  const [results] = await findAndUpdate(
    "chapters",
    { title },
    { id }
  );

  if (results.affectedRows === 0)
    return next(new AppError(404, "no chapter found with this id"));

  res.status(200).json({
    status: "Success",
  });
});

exports.deleteChapter=asyncChoke(async(req,res,next)=>{
  const {chapter_id,course_id} = req.body;
  
  const query = `delete from chapters where id = ? `
  await pool.query(query,[chapter_id])
  
  const getNewDuration=`SELECT SUM(duration) AS totalDuration 
    FROM lessons 
    JOIN chapters ON
    lessons.chapter_id=chapters.id
    WHERE course_id = ?`  

  const [result]=await pool.query(getNewDuration,[course_id])
  const total_duration = parseInt(result[0].totalDuration, 10) || 0;
 
  await findAndUpdate("courses",{total_duration},{id:course_id})

  res.status(200).json({
    status: "Success",
    message:"chapter deleted successfully"
  });
})