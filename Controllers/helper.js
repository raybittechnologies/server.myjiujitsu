const { asyncChoke } = require("../Utils/asyncWrapper");

exports.roundToNearest50 = (num) => {
  return Math.round(num / 2) * 2;
};
