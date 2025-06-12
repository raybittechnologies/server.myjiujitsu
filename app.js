const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const { Stripe } = require("stripe");

// const stripe = Stripe("your-stripe-secret-key");

const app = express();
const server = require("http").createServer(app);

const { initWebSocket } = require("./websocket/socketio");

initWebSocket(server);

const { sendError } = require("./Controllers/errorController");

const {
  webhookCheckout,
  webhookPayout,
} = require("./Controllers/paymentController");
const { webhookPoints } = require("./Controllers/userController");

app.use(
  cors({
    origin: [
      "http://192.168.100.39:5173",
      "http://192.168.1.4:5173",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:4173",
      "http://localhost:3000",
      "https://juijitsu.vercel.app",
      "https://myjiujitsu.com",
      "https://juijitsu-kcvmx1y3w-zahid01s-projects.vercel.app",
    ],
    credentials: true,
  })
);
app.enable("trust proxy");

app.post(
  "/webhook-checkout",
  express.raw({ type: "application/json" }),
  webhookCheckout
);

app.post(
  "/webhook-payout",
  express.raw({ type: "application/json" }),
  webhookPayout
);

app.use(cookieParser());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    resave: false,
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET,
  })
);

app.use(express.static(path.join(__dirname, "public")));

const AppError = require("./Utils/error");
const AuthRouter = require("./Routes/auth.routes");
const UserRouter = require("./Routes/user.routes");
const categoriesRouter = require("./Routes/categories.routes");
const coursesRouter = require("./Routes/courses.routes");
const TagsRouter = require("./Routes/tags.routes");
const courseTagRouter = require("./Routes/courseTags.routes");
const lessonsRouter = require("./Routes/lessons.routes");
const chaptersRouter = require("./Routes/chapter.routes");
const ReviewRouter = require("./Routes/review.routes");
const cartRouter = require("./Routes/cart.routes");
const chatRouter = require("./Routes/chat.routes");
const paymentRouter = require("./Routes/payment.routes");
const expertRouter = require("./Routes/expert.routes");
const adminRouter = require("./Routes/admin.routes");

app.use(express.json());
app.use("/api/v1/auth", AuthRouter);
app.use("/api/v1/users", UserRouter);
app.use("/api/v1/category", categoriesRouter);
app.use("/api/v1/courses", coursesRouter);
app.use("/api/v1/tags", TagsRouter);
app.use("/api/v1/courseTags", courseTagRouter);
app.use("/api/v1/lessons", lessonsRouter);
app.use("/api/v1/chapters", chaptersRouter);
app.use("/api/v1/reviews", ReviewRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/expert", expertRouter);
app.use("/api/v1/admin", adminRouter);

app.all("*", (_, __, next) => {
  next(new AppError(404, "No such URL found on this server"));
});

app.use(sendError);

module.exports = server;
