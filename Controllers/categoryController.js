const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const jwt = require("jsonwebtoken");
const {
  create,
  find,
  findAndUpdate,
  findAndDelete,
  findById,
} = require("./handlerFactory");

exports.createCategory = asyncChoke(async (req, res, next) => {
  const { name, parent_id } = req.body;

  if (!name) return next(new AppError(404, "provide all inputs"));

  await create("categories", { name, parent_id });

  res.status(200).json({
    message: "Success",
    message: "category added successfully",
  });
});

exports.createSubcategory = asyncChoke(async (req, res, next) => {
  const {name } = req.body;
  const { categoryId } = req.params;

  if (!categoryId || !name) {
    return next(new AppError(400, "Category ID and subcategory name are required"));
  }

  // Insert new subcategory into the categories table
  const query = `
    INSERT INTO categories (name, parent_id, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  const [result] = await pool.query(query, [name, categoryId]);

  res.status(201).json({
    message: "Subcategory created successfully",
    data: {
      id: result.insertId,
      name,
      parent_id: categoryId,
    },
  });
});


exports.UpdateCategory = asyncChoke(async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) return next(new AppError(404, "Nothing to update"));

  const [result] = await findAndUpdate("categories", { name }, { id });

  if (!result.affectedRows)
    return next(new AppError(404, "No category found with this id"));

  res.status(200).json({
    message: "Success",
    message: "category updated successfully",
  });
});

exports.deleteCategory = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const [result] = await findAndDelete("categories", { id });

  if (!result.affectedRows)
    return next(new AppError(404, "No category found with this id"));

  res.status(200).json({
    message: "Success",
    message: "category deleted successfully",
  });
});

exports.getSubcategoriesByCategoryId = asyncChoke(async (req, res, next) => {
  const { categoryId } = req.params;

  if (!categoryId) {
    return next(new AppError(400, "Category ID is required"));
  }

  const query = `
    SELECT 
      child.id AS subcategory_id,
      child.name AS subcategory_name
    FROM categories AS child
    WHERE child.parent_id = ?;
  `;

  const [results] = await pool.query(query, [categoryId]);

  if (results.length === 0) {
    return next(new AppError(404, "No subcategories found for this category"));
  }

  res.status(200).json({
    message: "Success",
    data: results,
  });
});

exports.deleteSubcategory = asyncChoke(async (req, res, next) => {
  const { subcategoryId } = req.params;

  if (!subcategoryId) {
    return next(new AppError(400, "Subcategory ID is required"));
  }

  // Delete only if the record is a subcategory (i.e., has a non-null parent_id)
  const deleteQuery = `
    DELETE FROM categories 
    WHERE id = ? AND parent_id IS NOT NULL;
  `;
  const [deleteResult] = await pool.query(deleteQuery, [subcategoryId]);

  if (deleteResult.affectedRows === 0) {
    return next(new AppError(404, "Subcategory not found or cannot delete a parent category"));
  }

  res.status(200).json({
    message: "Subcategory deleted successfully",
  });
});
exports.updateSubcategory = asyncChoke(async (req, res, next) => {
  const { subcategoryId } = req.params;
  const { name } = req.body;

  if (!subcategoryId) {
    return next(new AppError(400, "Subcategory ID is required"));
  }

  if (!name) {
    return next(new AppError(400, "New subcategory name is required"));
  }

  // Update the subcategory record if it is indeed a subcategory (i.e., parent_id is not null)
  const updateQuery = `
    UPDATE categories 
    SET name = ? 
    WHERE id = ? AND parent_id IS NOT NULL;
  `;
  const [updateResult] = await pool.query(updateQuery, [name, subcategoryId]);

  if (updateResult.affectedRows === 0) {
    return next(new AppError(404, "Subcategory not found or cannot update a parent category"));
  }

  res.status(200).json({
    message: "Subcategory updated successfully",
  });
});



exports.getAllCategories = asyncChoke(async (req, res, next) => {
  let token;
  const search = req.query.search || ""; // Get search query from request

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.JWT) {
    token = req.cookies.JWT;
  }

  let query = `SELECT id AS category_id, name AS category_name 
               FROM categories 
               WHERE parent_id IS NULL AND name LIKE ?`;

  let queryParams = [`%${search}%`];

  // if (token) {
  //   try {
  //     const { email } = jwt.verify(token, process.env.JWT_SECRET);
  //     const query1 = `SELECT user_type FROM users WHERE email=?`;
  //     let [user] = await pool.query(query1, [email]);
  //     user = user[0];

  //     if (user && user.user_type === "admin") {
  //       query = `SELECT id AS category_id, name AS category_name FROM categories WHERE name LIKE ?`;
  //     }
  //   } catch (error) {
  //     return next(new AppError(401, "Invalid token"));
  //   }
  // }

  const [results] = await pool.query(query, queryParams);

  if (results.length === 0) {
    return next(new AppError(404, "No categories found"));
  }

  res.status(200).json({
    message: "Success",
    data: results,
  });
});



exports.getCategoryById = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const [results] = await findById("categories", id);

  if (results.length === 0) {
    return next(new AppError(404, "No categories found"));
  }

  res.status(200).json({
    message: "Success",
    data: results,
  });
});

exports.getCategoriesWithSubcategories = asyncChoke(async (req, res, next) => {
  const search = req.query.search || ""; // Get search query from request

  // First, get all main categories (where parent_id is NULL)
  const mainCategoriesQuery = `
    SELECT id AS category_id, name AS category_name 
    FROM categories 
    WHERE parent_id IS NULL AND name LIKE ?
    ORDER BY name ASC
  `;
  
  const [mainCategories] = await pool.query(mainCategoriesQuery, [`%${search}%`]);
  
  if (mainCategories.length === 0) {
    return next(new AppError(404, "No categories found"));
  }
  
  // For each main category, get its subcategories
  const categoriesWithSubs = await Promise.all(
    mainCategories.map(async (category) => {
      const subcategoriesQuery = `
        SELECT id AS subcategory_id, name AS subcategory_name
        FROM categories
        WHERE parent_id = ?
        ORDER BY name ASC
      `;
      
      const [subcategories] = await pool.query(subcategoriesQuery, [category.category_id]);
      
      return {
        ...category,
        subcategories: subcategories || []
      };
    })
  );
  
  res.status(200).json({
    message: "Success",
    data: categoriesWithSubs
  });
});
