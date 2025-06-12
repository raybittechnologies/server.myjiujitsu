const { protect } = require("../Controllers/authController");
const {
  getChatList,
  createFavourite,
  RemoveFavourite,
  getMessagesOfChat,
  markUnread,
  getSupportChatList,
  getSupportMessages,
} = require("../Controllers/chatController");

const chatRouter = require("express").Router();

chatRouter.use(protect);
chatRouter
  .route("/")
  .get(getChatList)
  .post(createFavourite)
  .delete(RemoveFavourite);
chatRouter.route("/chatMessages/:receiver_id").get(getMessagesOfChat);
chatRouter.route("/chatMessages/:id").patch(markUnread);
chatRouter.route("/supportChat").get(getSupportChatList);
chatRouter.route("/supportChat/:receiver_id").get(getSupportMessages);

module.exports = chatRouter;
