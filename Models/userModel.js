const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

exports.isValidEmail = (email) => {
  const regex =
    /^(?!.*(\.{2}|@.*@))[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?!.*\.{2})[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return regex.test(email);
};

exports.isValidPassword = (password) => {
  if (password.length < 8) {
    return false;
  }
  if (!/[a-z]/.test(password)) {
    return false;
  }
  if (!/[A-Z]/.test(password)) {
    return false;
  }
  if (!/\d/.test(password)) {
    return false;
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return false;
  }
  return true;
};

exports.hashPassword = async (password) => {
  const hashedPw = await bcrypt.hash(password, 10);

  return hashedPw;
};

exports.comparePassword = async (password, hash) => {
  const result = await bcrypt.compare(password, hash);
  return result;
};

exports.isUnderTrial = (trial_start_date) => {
  const trialPeriod =
    (Date.now() - new Date(trial_start_date)) / (1000 * 60 * 60 * 24);

  return trialPeriod > process.env.TRIAL_PERIOD;
};

exports.genVerifyLink = (email) => {
  const token = jwt.sign({ data: email }, process.env.JWT_SECRET, {
    expiresIn: "59m",
  });

  return token;
};

exports.changePasswordToken = () => {
  let token = crypto.randomBytes(32).toString("hex");
  const passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const passwordResetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);

  return { passwordResetToken, passwordResetTokenExpires };
};

exports.generateRandomString = () => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomString = "";

  for (let i = 0; i < 8; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    randomString += charset.charAt(randomIndex);
  }

  return randomString;
};
