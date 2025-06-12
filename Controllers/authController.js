const jwt = require("jsonwebtoken");

const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");

const {
  hashPassword,
  comparePassword,
  isUnderTrial,
  genVerifyLink,
  changePasswordToken,
  isValidEmail,
  isValidPassword,
} = require("../Models/userModel");
const Email = require("../Utils/mailer");
const AppError = require("../Utils/error");
const { create, findAndUpdate, findOne } = require("./handlerFactory");
const passport = require("passport");

const createSendToken = (res, req, email) => {
  const tokenOptions = { expiresIn: process.env.JWT_EXPIRY };
  const token = jwt.sign({ email }, process.env.JWT_SECRET, tokenOptions);

  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: "none",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    // secure: true,
  };

  res.cookie("JWT", token, cookieOptions);
  return token;
};

exports.verifyEmail = asyncChoke(async (req, res, next) => {
  const { token } = req.params;

  // const email = jwt.verify(token, process.env.JWT_SECRET);
  let email;
  try {
    email = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return next(new AppError(400, "Invalid or expired token"));
  }

  const [user] = await findOne("users", { email: email.data });

  if (!user) {
    return next(new AppError(404, "User not found"));
  }

  if (user.email_verified_at) {
    const message = "email is already verified";
    res.redirect(
      `${
        process.env.CLIENT_DOMAIN
      }?response=success&message=${encodeURIComponent(message)}`
    );
  }

  const query2 = `update users set status=?, email_verified_at=now(),email_verified=1 where id=?`;
  await pool.query(query2, [true, user.id]);

  const successMessage = "Your email is verified successfully!";

  res.redirect(
    `${process.env.CLIENT_DOMAIN}?response=success&message=${encodeURIComponent(
      successMessage
    )}`
  );
  //   res.status(200).json({
  //     message: "Your email is verified successfully",
  //   });
});

exports.getVerificationToken = asyncChoke(async (req, res, next) => {
  const { email } = req.body;

  const [user] = await findOne("users", { email });

  if (!user) {
    return next(new AppError(404, "User not found"));
  }
  if (user.email_verified === 1)
    return next(new AppError(409, "Your email is already verified"));

  const token = jwt.sign(
    { data: { email, id: user.id } },
    process.env.JWT_SECRET,
    {
      expiresIn: "59m",
    }
  );
  const uri = `${process.env.BACKEND_DOMAIN}/api/v1/auth/email/updateEmail/${token}`;
  new Email(email, uri, user.name).sendWelcome();

  res.status(200).json({
    status: "Success",
    message: `A verification link is sent to your email ${user.name}`,
  });
});

exports.addUser = asyncChoke(async (req, res, next) => {
  let { email, name, password, confirmPassword } = req.body;
  if (!name || !email || !password || !confirmPassword) {
    return next(new AppError(400, "provide all inputs"));
  }
  // const profile_picture = req.file.path;

  if (!isValidEmail(email)) {
    return next(new AppError(400, "The email you provided is not valid"));
  }

  if (!isValidPassword(password)) {
    return next(new AppError(400, "This password is too weak"));
  }

  if (password !== confirmPassword) {
    return next(new AppError(400, "passwords does not match"));
  }

  const [existingUser] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  console.log(existingUser, email);
  if (existingUser.length > 0) {
    return next(new AppError(400, "User already exists"));
  }

  const hashedpassword = await hashPassword(password);

  const user = await create("users", {
    email,
    password: hashedpassword,
    name,
    user_type: "user",
    status: false,
  });

  //SEND EMAIL
  const token = genVerifyLink(email);
  // const uri = `${process.env.CLIENT_DOMAIN}/${token}`;
  const uri = `${process.env.BACKEND_DOMAIN}/api/v1/auth/${token}`;
  new Email(email, uri, name).sendWelcome();

  res.status(200).json({
    status: "Success",
    Message: `A verification link is sent to your email ${email}`,
  });
});

exports.login = asyncChoke(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return next(new AppError(401, "Provide all the credentials"));

  const query = `Select id,email,name,user_type,profile_picture,password,status,email_verified
   from users where email=?`;

  let [result] = await pool.query(query, [email]);
  result = result[0];

  if (!result)
    return next(new AppError(404, "No user found with those credentials"));

  if (!(await comparePassword(password, result.password)))
    return next(new AppError(401, "Invalid Credentials"));

  if (result.status === 0) return next(new AppError(404, "user is not active"));
  if (result.email_verified === 0)
    return next(new AppError(404, "email is not verified yet"));

  const token = createSendToken(res, req, result.email);

  res.status(200).json({
    status: "Success",
    Data: result,
    token,
  });
});

exports.protect = asyncChoke(async (req, res, next) => {
  // console.log("protect");
  let token;
  // console.log(req.headers.authorization);
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  )
    token = req.headers.authorization.split(" ")[1];
  else if (req.cookies.JWT) token = req.cookies.JWT;

  const cookies = token;
  // console.log(token);
  if (!cookies) return next(new AppError(400, "Not logged in."));

  const { email } = jwt.verify(cookies, process.env.JWT_SECRET);

  const query = `SELECT id, user_type, email FROM users  WHERE email=?`;

  const [results] = await pool.query(query, [email]);

  const user = results[0];

  req.user = user;

  next();
});

// exports.loggerUserIdentifier = asyncChoke(async (req, res, next) => {
//   const url = req.originalUrl;
//   const bypassUrls = ["/api/v1/users/login"];
//   if (bypassUrls.includes(url)) return next();

//   let token;
//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   )
//     token = req.headers.authorization.split(" ")[1];
//   else if (req.cookies.JWT) token = req.cookies.JWT;

//   const cookies = token;

//   if (!cookies) {
//     req.user = null;
//     return next();
//   }

//   const { email } = jwt.verify(cookies, process.env.JWT_SECRET);

//   const query = `SELECT rb_profile.id, role_id, email FROM rb_users JOIN rb_profile ON rb_users.id = rb_profile.user_id WHERE email=?`;

//   const [results] = await req.db.query(query, [email]);

//   const user = results[0];

//   req.user = user;
//   next();
// });

exports.logout = asyncChoke(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  )
    token = req.headers.authorization.split(" ")[1];
  else if (req.cookies.JWT) token = req.cookies.JWT;

  const cookies = token;

  if (!cookies) return next(new AppError(400, "No logged in User found!"));

  const cookieOptions = {
    expires: new Date(Date.now() + 1000),
    httpOnly: true,
    sameSite: "none",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    // secure: true,
  };

  res.cookie("JWT", "Your session is about to expire!", cookieOptions);

  res.status(200).json({
    status: "Success",
    message: "You have been logged out!",
  });
});

exports.isLoggedIn = asyncChoke(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  )
    token = req.headers.authorization.split(" ")[1];
  else if (req.cookies.JWT) token = req.cookies.JWT;

  const cookies = token;

  if (!cookies) return next(new AppError(400, "Not logged in."));

  const { email } = jwt.verify(cookies, process.env.JWT_SECRET);

  const profileQuery = `
  SELECT rb_profile.id, fullname, role,picture
  FROM rb_users
  JOIN rb_roles
  ON rb_users.role_id = rb_roles.id
  JOIN rb_profile
  ON rb_users.id =rb_profile.user_id
  where
  email = ?
  `;

  const [getProfile] = await req.db.query(profileQuery, [email]);

  const user = {
    id: getProfile[0].id,
    fullname: getProfile[0].fullname,
    role: getProfile[0].role,
    picture: getProfile[0].picture,
  };

  const cookieOptions = {
    expires: new Date(Date.now() + 1000),
    httpOnly: true,
    sameSite: "none",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    // secure: true,
  };

  if (!user) {
    res.cookie("JWT", "Your session is about to expire!", cookieOptions);
    return next(
      new AppError(
        404,
        "Good luck using malformed JWT, its Khans code running at the backend"
      )
    );
  }

  req.user = user;
  res.status(200).json({
    status: "Success",
    Data: user,
    token: cookies,
  });
});

exports.forgotPassword = asyncChoke(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError(401, "Provide your email"));

  const [user] = await findOne("users", { email });

  if (!user) return next(new AppError(401, "No user found with this email."));
  console.log(user);

  const resetToken = changePasswordToken();

  await findAndUpdate(
    "users",
    {
      password_reset_token: resetToken.passwordResetToken,
      password_reset_expiry: resetToken.passwordResetTokenExpires,
    },
    { email }
  );

  const resetUrl = `${process.env.CLIENT_DOMAIN}resetPassword/${resetToken.passwordResetToken}`;

  new Email(email, resetUrl, user.name).sendPasswordReset();

  res.status(200).json({
    status: "Success",
    message: "Email to reset your password sent to your email",
  });
});

exports.resetPassword = asyncChoke(async (req, res, next) => {
  const { token } = req.params;

  const query = `SELECT * FROM users WHERE password_reset_token=? AND password_reset_expiry > ?`;
  const [results] = await pool.query(query, [token, new Date(Date.now())]);

  if (!results.length)
    return next(new AppError(401, "Invalid token or token expired"));

  const { password, confirmPassword } = req.body;
  if (!password || !confirmPassword)
    return next(new AppError(401, "Provide password and confirm password"));

  if (password !== confirmPassword) {
    return next(new AppError(401, "passwords does not match"));
  }

  const hash = await hashPassword(password);
  const updateQuery =
    "UPDATE users SET password = ? WHERE password_reset_token = ?";
  await pool.query(updateQuery, [hash, token]);

  res.status(200).json({
    status: "Success",
    message: "Password updated successfuly",
  });
});

exports.updatePassword = asyncChoke(async (req, res, next) => {
  const { password, newPassword, passwordConfirm } = req.body;

  if (!password || !newPassword || !passwordConfirm)
    return next(new AppError(401, "Provide password and confirm password"));

  if (newPassword !== passwordConfirm) {
    return next(new AppError(401, "passwords does not match"));
  }

  let [rootUser] = await pool.query("SELECT * FROM users WHERE email = ?", [
    req.user.email,
  ]);
  rootUser = rootUser[0];

  const passwordCheck = await comparePassword(password, rootUser.password);
  if (!passwordCheck) return next(new AppError(401, "Old password Incorrect"));

  const hash = await hashPassword(newPassword);
  const updateQuery = "UPDATE users SET password = ? WHERE email = ?";
  const user = await pool.query(updateQuery, [hash, rootUser.email]);

  res.status(200).json({
    status: "Success",
    message: "password updated successfully",
  });
});

exports.restrictTo = (role) => {
  return async (req, res, next) => {
    const roles = role.map((el) => `${el}`);

    const query = `SELECT user_type FROM users WHERE id = ? AND status = 1`;
    const [results] = await pool.query(query, [req.user.id]);

    if (results.length === 0) {
      return next(new AppError(401, "User not found or not active"));
    }

    const userRole = results[0].user_type;

    if (!roles.includes(userRole)) {
      return next(
        new AppError(401, "You don't have permission to perform this action")
      );
    }

    next();
  };
};

exports.successGoogleLogin = async (req, res) => {
  const user = req.user;
  console.log(user);
  const existingUserquery = `select * from users where email=? or google_id=?`;
  const [existingUser] = await pool.query(existingUserquery, [
    user._json.email,
    user.id,
  ]);

  if (existingUser.length === 0) {
    const newuser = await create("users", {
      google_id: user.id,
      email: user._json.email,
      name: user._json.name,
      user_type: "user",
      status: true,
      profile_picture: user.photos[0].value,
      email_verified: true,
      email_verified_at: new Date(Date.now()),
    });

    await create("profiles", {
      user_id: newuser.insertId,
    });
  }
  const token = createSendToken(res, req, user._json.email);
  const query = `Select id,email,name,user_type,profile_picture,status from users where email=?`;

  let [result] = await pool.query(query, [user._json.email]);
  result = result[0];

  const response = {
    status: "success",
    token,
    user: result,
  };

  const encodedResponse = encodeURIComponent(JSON.stringify(response));
  res.redirect(`${process.env.CLIENT_DOMAIN}?response=${encodedResponse}`);
};

exports.failureGoogleLogin = (req, res) => {
  res.send(err);
};

// exports.getEmail = asyncChoke(async (req, res, next) => {
//   const { id } = req.user;
//   const query = `select id,email from users where id=?`;
//   const [user] = await pool.query(query, [id]);
//   if (user.length === 0) {
//     return next(new AppError(404, "no user found"));
//   }
//   res.status(200).json({
//     status: "Success",
//     data: user[0],
//   });
// });

exports.changeEmail = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { email, password } = req.body;

  const query = `select password,name,google_id from users where id=?`;
  const [user] = await pool.query(query, [id]);

  if (user.length === 0) {
    return next(new AppError(404, "no user found"));
  }

  if (user[0].google_id !== null)
    return next(
      new AppError(
        401,
        "Cannot update the email as you have logged in through google"
      )
    );

  if (!(await comparePassword(password, user[0].password)))
    return next(new AppError(401, "Invalid password"));

  // Check if another account exists with the given email
  const emailCheckQuery = `select id from users where email=?`;
  const [existingEmail] = await pool.query(emailCheckQuery, [email]);

  if (existingEmail.length > 0) {
    return next(new AppError(409, "Email is already in use by another account"));
  }

  const query2 = `update users set email=? , email_verified=0 where id=?`;
  await pool.query(query2, [email, id]);

  const token = jwt.sign({ data: { email, id } }, process.env.JWT_SECRET, {
    expiresIn: "59m",
  });
  const uri = `https://elearn-pv2m.onrender.com/api/v1/auth/email/updateEmail/${token}`;
  new Email(email, uri, user[0].name).sendWelcome();

  const cookieOptions = {
    expires: new Date(Date.now() + 1000),
    httpOnly: true,
    sameSite: "none",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  };

  res.cookie("JWT", "Your session is about to expire!", cookieOptions);

  res.status(200).json({
    status: "Success",
    Message: `A verification link is sent to your email ${email}`,
  });
});

exports.EmailUpdateVerification = asyncChoke(async (req, res, next) => {
  const { token } = req.params;

  let data;
  try {
    data = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return next(new AppError(400, "Invalid or expired token"));
  }

  const query2 = `update users set email_verified_at=now() , email_verified=1 where id=?`;
  await pool.query(query2, [data.data.id]);

  const successMessage = "Your email is verified successfully!";
  res.redirect(
    `${process.env.CLIENT_DOMAIN}?response=success&message=${encodeURIComponent(
      successMessage
    )}`
  );
});

exports.deleteAccount = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { password } = req.body;
  // console.log(password);

  const query = `select password,name from users where id=?`;
  const [user] = await pool.query(query, [id]);

  if (user.length === 0) {
    return next(new AppError(404, "no user found"));
  }

  if (!(await comparePassword(password, user[0].password)))
    return next(new AppError(401, "Invalid password"));

  const deleted = `update users set status=? where id=?`;
  await pool.query(deleted, [false, id]);

  res.status(200).json({
    status: "Success",
    message: "account deleted successfully",
  });
});
