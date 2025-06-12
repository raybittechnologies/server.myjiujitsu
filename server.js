const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const server = require("./app");

server.listen(process.env.PORT, "0.0.0.0", () => {
  console.log("Server fired on PORT : ", process.env.PORT);
});
