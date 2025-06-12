const socketIo = require("socket.io");
const { socketAuth } = require("./socketAuth");
const {
  saveMessageToUsers,
  saveMessageToAdmin,
} = require("../Controllers/chatController");

let io;

function initWebSocket(server) {
  io = socketIo(server, {
    cors: {
      origin: [
        "http://192.168.100.39:5173",
        "http://192.168.1.4:5173",
        "http://localhost:5173",
        "https://myjiujitsu.com",
        "https://backend.myjiujitsu.com",
        // "*"
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  io.connectedUsers = {};

  io.use(async (socket, next) => {
    await socketAuth(socket, next);
  });

  io.on("connection", (socket) => {
    console.log("Socket Client Connected", socket.user.email);

    if (!io.connectedUsers[socket.user.email])
      io.connectedUsers[socket.user.email] = socket;

    // socket.on(
    //   "activ_group_chat",
    //   async (messageData) => await groupChat(socket, messageData)
    // );

    // socket.on("message", (msg) => {
    //   console.log(msg);
    // });

    socket.on("private_message", async ({ msg, friend }) => {
      const { id } = socket.user;
      await saveMessageToUsers(friend, id, msg);
      if (io.connectedUsers[friend]) {
        const messagePayload = {
          message: msg,
          date: new Date(),
        };
        io.connectedUsers[friend].emit("privateMessage", messagePayload);
      }
    });

    socket.on("support_message", async ({ msg, friend }) => {
      const { id } = socket.user;
      await saveMessageToAdmin(friend, id, msg);
      if (io.connectedUsers[friend]) {
        const messagePayload = {
          message: msg,
          date: new Date(),
        };
        io.connectedUsers[friend].emit("supportMessage", messagePayload);
      }
    });

    socket.on("disconnect", async () => {
      delete io.connectedUsers[socket.user.email];
      console.log("A user disconnected", socket.user.email);
    });
  });
}

function getSocketIoServer() {
  return io;
}

module.exports = { initWebSocket, getSocketIoServer };
