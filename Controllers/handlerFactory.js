const { pool } = require("../Config/database");

const { asyncChoke } = require("../Utils/asyncWrapper");

const getQueryFillers = (data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);

  let queryFiller = {};

  queryFiller.cols = keys.join(",");
  queryFiller.values = values;
  queryFiller.count = values.map(() => "?").join(",");

  return queryFiller;
};

const updateQueryFiller = (data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);

  let queryFiller = {};
  queryFiller.cols = keys.join(" = ?,");
  queryFiller.values = values;

  queryFiller.cols += " = ?";

  return queryFiller;
};

//FIND ONE
exports.findOne = async (table, data) => {
  const filler = getQueryFillers(data);
  const query = `SELECT * FROM ${table} WHERE ${filler.cols} = ?`;
  const [results] = await pool.query(query, filler.values);
  return results;
};

// FIND MANY
exports.findMany = async (table, data) => {
  const filler = getQueryFillers(data);
  const query = `SELECT * FROM ${table} WHERE ${filler.cols} = ?`;
  return await pool.query(query, filler.values);
};

//FIND
exports.find = async (table) => await pool.query(`SELECT * FROM ${table}`);

//FIND BY ID
exports.findById = async (table, id) => {
  const query = `SELECT * FROM ${table} WHERE id = ?`;

  const [results] = await pool.query(query, [id]);

  return results;
};

//CREATE
exports.create = async (table, data) => {
  const filler = getQueryFillers(data);

  const query = `INSERT INTO ${table} (${filler.cols}) VALUES (${filler.count})`;

  const [result] = await pool.query(query, filler.values);
  return result;
};

//FIND AND UPDATE
exports.findAndUpdate = async (table, data, condition) => {
  const filler = updateQueryFiller(data);
  const filler2 = getQueryFillers(condition);

  const query = `UPDATE ${table} SET ${filler.cols} WHERE ${filler2.cols} = ${filler2.count}`;
  console.log(query);

  return await pool.query(query, [...filler.values, ...filler2.values]);
};

//Find and delete
exports.findAndDelete = async (table, condition) => {
  const filler = getQueryFillers(condition);

  const query = `DELETE FROM ${table} WHERE ${filler.cols} = ${filler.count}`;

  return await pool.query(query, filler.values);
};

//  delete multiple
exports.deleteMany = async (pool, table, ids) => {
  const filler = getQueryFillers(ids);

  const query = `DELETE FROM ${table} WHERE ${
    filler.cols
  } in (${filler.values.join(",")})`;
  return await pool.query(query);
};

//===============================================================================================//
exports.getIdByEmail = async (pool, table, email) => {
  const getUserId = `SELECT id FROM ${table} WHERE email = ?`;

  const [resultsUser] = await pool.query(getUserId, [email]);

  return resultsUser[0]?.id;
};

exports.getSingleRecordById = async (pool, table, id) => {
  const query = `SELECT * FROM ${table} WHERE profile_id = ?`;

  return await pool.query(query, [id]);
};

exports.getRecord = async (pool, table, attribute, key) => {
  const query = `SELECT * FROM ${table} WHERE ${attribute} = ?`;

  return await pool.query(query, [key]);
};

exports.getAllRecordsById = async (pool, table, id) => {
  const query = `SELECT * FROM ${table} WHERE user_id = ?)`;

  return await pool.query(query, [id]);
};

exports.insertOne = async (pool, table, id, data) => {
  const query = `INSERT INTO ${table} (profile_id, start_time) VALUES (?,?)`;

  await pool.query(query, [id, data]);
};

//Specific QUERIES
exports.getLastEntry = async (pool, table, id) => {
  const lastEntryQuery = `SELECT * FROM ${table} WHERE profile_id = ? ORDER BY id DESC LIMIT 1`;

  const [lastEntry] = await pool.query(lastEntryQuery, [id]);
  return lastEntry[0];
};

exports.updateEndTime = async (pool, table, id) => {
  const lastUpdateQuery = `UPDATE ${table} SET end_time=? WHERE id = ?`;

  await pool.query(lastUpdateQuery, [new Date(Date.now()), id]);
};

exports.updateStatus = async (pool, table, id) => {
  const lastUpdateQuery = `UPDATE ${table} SET is_active=? WHERE id = ?`;
  const [deletedEntry] = await pool.query(lastUpdateQuery, [0, id]);
  return deletedEntry;
};

exports.updateEndTimeTemp = async (pool, table, id) => {
  const lastUpdateQuery = `UPDATE ${table} SET end_time=? WHERE profile_id = ?`;

  await pool.query(lastUpdateQuery, [new Date(Date.now()), id]);
};

exports.setActive = async (status, table, ids) => {
  const filler = getQueryFillers(ids);
  const query = `UPDATE ${table} SET is_active = ${status} WHERE id in (${filler.values.join(
    ","
  )})`;
  await pool.query(query, ids);
};
