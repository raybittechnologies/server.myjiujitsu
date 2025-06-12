const { protect, restrictTo } = require("../Controllers/authController");
const {
  createCategory,
  getAllCategories,
  UpdateCategory,
  deleteCategory,
  getCategoryById,
  getSubcategoriesByCategoryId,
  deleteSubcategory,
  updateSubcategory,
  createSubcategory,
  getCategoriesWithSubcategories,
} = require("../Controllers/categoryController");

const categoriesRouter = require("express").Router();

categoriesRouter.route("/").get(getAllCategories);
categoriesRouter.route("/with-subcategories").get(getCategoriesWithSubcategories);
categoriesRouter.route("/:categoryId/subcategories").get(getSubcategoriesByCategoryId);

categoriesRouter.use(protect, restrictTo(["admin"]));
categoriesRouter.route("/").post(createCategory);

categoriesRouter.route('/:categoryId/subcategories').post(createSubcategory);
categoriesRouter.route('/:subcategoryId/subcategories').delete(deleteSubcategory);
categoriesRouter.route('/:subcategoryId/subcategories').patch(updateSubcategory);
categoriesRouter
  .route("/:id")
  .patch(UpdateCategory)
  .delete(deleteCategory)
  .get(getCategoryById);

module.exports = categoriesRouter;
