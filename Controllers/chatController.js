const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const {
  create,
  findOne,
  findMany,
  findAndUpdate,
  deleteMany,
} = require("./handlerFactory");

exports.saveMessageToUsers = asyncChoke(async (receiver, sender, message) => {
  const [user] = await findOne("users", { email: receiver });
  await create("chats", {
    message,
    sender_id: sender,
    receiver_id: user.id,
    created_at: new Date(Date.now()),
    updated_at: new Date(Date.now()),
  });
  console.log("message saved");
});

exports.saveMessageToAdmin = asyncChoke(async (receiver, sender, message) => {
  const [user] = await findOne("users", { email: receiver });
  await create("support_chat", {
    message,
    sender_id: sender,
    receiver_id: user.id,
    created_at: new Date(Date.now()),
    updated_at: new Date(Date.now()),
  });
  console.log("message saved");
});

exports.createFavourite = asyncChoke(async (req, res, next) => {
  const { receiver } = req.body;
  const { id } = req.user;
  if (!receiver) return next(new AppError(404, "provide id of expert"));

  const query = `select * from favourites where favourite=? and favourite_by=?`;
  const [result] = await pool.query(query, [receiver, id]);

  if (result.length !== 0)
    return next(new AppError(404, "already added to favourites"));

  await create("favourites", { favourite: receiver, favourite_by: id });
  res.status(200).json({
    status: "success",
    message: "user added to favourites",
  });
});

exports.RemoveFavourite = asyncChoke(async (req, res, next) => {
  const { receiver } = req.body;
  const { id } = req.user;
  if (!receiver) return next(new AppError(404, "provide id of expert"));
  const query = `delete from favourites where favourite=? AND favourite_by=?`;
  await pool.query(query, [receiver, id]);
  res.status(200).json({
    status: "success",
    message: "user removed from favourites",
  });
});

exports.getChatList = asyncChoke(async (req, res, next) => {
  const { search } = req.query;
  const { id } = req.user;
  let partialQuery = "";
  if (search) {
    partialQuery = `AND users.name LIKE '%${search}%' `;
  }
  const query = `WITH LatestMessages AS (
    SELECT 
        chats.id AS chat_id,
        chats.message,
         CASE 
        WHEN chats.receiver_id = ? THEN chats.is_read 
        ELSE NULL 
        END AS is_read, 
        chats.updated_at,
        CASE 
            WHEN chats.sender_id = ? THEN chats.receiver_id
            ELSE chats.sender_id
        END AS expert_id,
        ROW_NUMBER() OVER (
            PARTITION BY CASE 
                WHEN chats.sender_id = ? THEN chats.receiver_id
                ELSE chats.sender_id
            END 
            ORDER BY chats.updated_at DESC
        ) AS rn
    FROM chats
    WHERE chats.sender_id = ? OR chats.receiver_id = ?
)

SELECT DISTINCT 
    users.id as expert_id, 
    users.name, 
    users.email,
    users.profile_picture,
    latest.chat_id,
    latest.message,
    latest.is_read,
    latest.updated_at,
    CASE WHEN favourites.favourite IS NOT NULL THEN TRUE ELSE FALSE END AS is_favorite
FROM users 
LEFT JOIN favourites ON favourites.favourite = users.id AND favourites.favourite_by = ?
 JOIN LatestMessages latest ON latest.expert_id = users.id AND latest.rn = 1
${partialQuery};
`;

  const [list] = await pool.query(query, [id, id, id, id, id, id]);
  res.status(200).json({
    status: "success",
    data: list,
  });
});

exports.getSupportChatList = asyncChoke(async (req, res, next) => {
  const { search } = req.query;
  const { id } = req.user;
  let query;

  let partialQuery = "";
  if (search) {
    partialQuery = `AND users.name LIKE '%${search}%' `;
  }

  if (req.user.user_type === "admin") {
    query = `WITH LatestMessages AS (
      SELECT 
          support_chat.id AS chat_id,
          support_chat.message,
          CASE 
            WHEN support_chat.receiver_id = ? THEN support_chat.is_read 
            ELSE NULL 
          END AS is_read,
          support_chat.updated_at,
          CASE 
            WHEN support_chat.sender_id = ? THEN support_chat.receiver_id
            ELSE support_chat.sender_id
          END AS admin_id,
          ROW_NUMBER() OVER (
            PARTITION BY CASE 
                WHEN support_chat.sender_id = ? THEN support_chat.receiver_id
                ELSE support_chat.sender_id
            END 
            ORDER BY support_chat.updated_at DESC
          ) AS rn
      FROM support_chat
      WHERE support_chat.sender_id = ? OR support_chat.receiver_id = ?
    )

    SELECT DISTINCT 
        users.id AS user_id, 
        users.name, 
        users.email,
        users.profile_picture,
        latest.chat_id,
        latest.message,
        latest.is_read,
        latest.updated_at
    FROM users
    JOIN LatestMessages latest ON latest.admin_id = users.id AND latest.rn = 1
    ${partialQuery};
    `;
  }

  if (req.user.user_type === "user" || req.user.user_type === "expert") {
    query = `WITH LatestMessages AS (
      SELECT 
          support_chat.id AS chat_id,
          support_chat.message,
          CASE 
            WHEN support_chat.receiver_id = ? THEN support_chat.is_read 
            ELSE NULL 
          END AS is_read,
          support_chat.updated_at,
          CASE 
            WHEN support_chat.sender_id = ? THEN support_chat.receiver_id
            ELSE support_chat.sender_id
          END AS admin_id,
          ROW_NUMBER() OVER (
            PARTITION BY CASE 
                WHEN support_chat.sender_id = ? THEN support_chat.receiver_id
                ELSE support_chat.sender_id
            END 
            ORDER BY support_chat.updated_at DESC
          ) AS rn
      FROM support_chat
      WHERE support_chat.sender_id = ? OR support_chat.receiver_id = ?
    )

    SELECT DISTINCT 
      users.id AS user_id, 
      users.name,
      users.email,
      users.profile_picture,
      latest.chat_id,
      latest.message,
      latest.is_read,
      latest.updated_at
    FROM users
    JOIN LatestMessages latest ON latest.admin_id = users.id AND latest.rn = 1
    `;
  }

  let [list] = await pool.query(query, [id, id, id, id, id]);

  // If no chat exists for a user/expert, fall back to admin list with full details.
  if (
    list.length === 0 &&
    (req.user.user_type === "user" || req.user.user_type === "expert")
  ) {
    [list] = await pool.query(
      `SELECT id AS user_id, name, email, profile_picture FROM users WHERE user_type="admin"`
    );
  }

  res.status(200).json({
    status: "success",
    data: list,
  });
});


exports.getMessagesOfChat = asyncChoke(async (req, res, next) => {
  const { receiver_id } = req.params;
  const { id } = req.user;

  if (!receiver_id) return next(new AppError(404, "provide the receiver id"));

  const updateQuery = `UPDATE chats
  SET is_read = 1
  WHERE
  receiver_id = ? AND sender_id = ? AND is_read = 0`;

  await pool.query(updateQuery, [id, receiver_id]);

  const query = `SELECT * FROM chats
  WHERE
  ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
  AND deleted_by_sender = 0
`;
  const [messages] = await pool.query(query, [
    id,
    receiver_id,
    receiver_id,
    id,
  ]);

  res.status(200).json({
    status: "success",
    data: messages,
  });
});

exports.getSupportMessages = asyncChoke(async (req, res, next) => {
  const { receiver_id } = req.params;
  const { id } = req.user;

  if (!receiver_id) return next(new AppError(404, "provide the receiver id"));

  const updateQuery = `UPDATE support_chat
  SET is_read = 1
  WHERE
  receiver_id = ? AND sender_id = ? AND is_read = 0`;

  await pool.query(updateQuery, [id, receiver_id]);

  const query = `SELECT * FROM support_chat
  WHERE
  ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
`;
  const [messages] = await pool.query(query, [
    id,
    receiver_id,
    receiver_id,
    id,
  ]);

  res.status(200).json({
    status: "success",
    data: messages,
  });
});

exports.markUnread = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const [chat] = await findOne("chats", { id });
  if (chat.is_read === 1) {
    await findAndUpdate("chats", { is_read: 0 }, { id });
  }
  res.status(200).json({
    status: "success",
    chat,
  });
});
