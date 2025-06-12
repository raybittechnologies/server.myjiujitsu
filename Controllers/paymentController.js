const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const stripe = require("stripe")(
//   "sk_test_51PubCwDq08j41MMzmGKjzQ2dIeGrJGG7YjqbKXr1DoKOVczjVPmutrgdIWLhCES9ra0brPHM9dYpIGWB6i3SjDDQ002jXbBTeq"
// );
const { pool } = require("../Config/database");
const { asyncChoke } = require("../Utils/asyncWrapper");
const AppError = require("../Utils/error");
const {
  findById,
  findMany,
  findOne,
  deleteMany,
  create,
  findAndUpdate,
  find,
} = require("./handlerFactory");
const { createPointsCheckout } = require("./userController");

exports.purchaseByPoints = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { course_id } = req.params;

  const query = `select * from users_courses where user_id=? and course_id=?`;
  const [user_course] = await pool.query(query, [id, course_id]);

  if (user_course.length)
    return next(new AppError(401, "This course is already purchased"));

  const query1 = `SELECT 
  title, price,
  FLOOR(price - (price * discount / 100)) AS discounted_price
  FROM courses WHERE  id = ?`;
  let [course] = await pool.query(query1, [course_id]);
  course = course[0];

  const coursePriceInCoins = course.discounted_price / process.env.POINT;

  const coinQuery = `SELECT COALESCE(sum(points), 0) AS total_points
  FROM user_points WHERE user_id = ?;`;
  let [coins] = await pool.query(coinQuery, [req.user.id]);

  const used_coins = ` SELECT  
    COALESCE(SUM(amount), 0) as usedCoins
FROM 
    payments
WHERE 
    user_id = ? and payment_type=?
`;
  let [usedCoins] = await pool.query(used_coins, [req.user.id, "coins"]);
  usedCoins = usedCoins[0].usedCoins / process.env.POINT;

  coins[0].total_points = coins[0].total_points - usedCoins;

  if (coins[0].total_points < coursePriceInCoins)
    return next(
      new AppError(401, "You dont have this much of coins in your wallet")
    );

  const commissionquery = `select commission from commission`;
  const [commission] = await pool.query(commissionquery);

  await create("payments", {
    user_id: id,
    amount: course.discounted_price,
    payment_type: "coins",
    payment_status: "paid",
    payment_date: new Date(Date.now()),
    course_id,
    commission_rate: commission[0].commission,
    coin_rate: process.env.POINT,
  });
  await create("users_courses", {
    course_id,
    user_id: id,
  });
  const query2 = `update courses set enrolled = enrolled + 1 where id=?`;
  await pool.query(query2, [course_id]);

  res.status(200).json({
    status: "Success",
    message: "course purchased successfully",
  });
});

exports.getCheckOutSession = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { course_id } = req.params;

  const query2 = `select * from users_courses where user_id=? and course_id=?`;
  const [user_course] = await pool.query(query2, [id, course_id]);

  if (user_course.length)
    return next(new AppError(401, "This course is already purchased"));

  const query = `SELECT 
  title, price,
    FLOOR(price - (price * discount / 100)) AS discounted_price
  FROM courses WHERE  id = ?`;

  let [course] = await pool.query(query, [course_id]);
  course = course[0];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    success_url: `${process.env.CLIENT_DOMAIN}/myLearning`,
    cancel_url: `${process.env.CLIENT_DOMAIN}`,
    customer_email: req.user.email,
    client_reference_id: id,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(course.discounted_price * 100),
          product_data: {
            name: course.title,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: id,
      courseId: course_id,
      sessionType: "purchase_course",
    },
    mode: "payment",
  });

  res.status(200).json({
    status: "Success",
    session,
  });
});

const createBookingCheckout = async (session) => {
  const commissionquery = `select commission from commission`;
  const [commission] = await pool.query(commissionquery);

  const paymentDate = new Date(session.created * 1000).toLocaleString();

  await create("payments", {
    user_id: session.metadata.user_id,
    amount: session.amount_total / 100,
    payment_type: session.payment_method_types,
    payment_status: session.payment_status,
    transaction_id: session.payment_intent,
    payment_date: new Date(paymentDate),
    course_id: session.metadata.courseId,
    commission_rate: commission[0].commission,
  });
  await create("users_courses", {
    course_id: session.metadata.courseId,
    user_id: session.metadata.user_id,
  });
  const query = `update courses set enrolled = enrolled+1 where id=?`;
  await pool.query(query, [session.metadata.courseId]);
};

exports.webhookCheckout = (req, res, next) => {
  const signature = req.headers["stripe-signature"];
  console.log("i am here");
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const sessionType = session.metadata.sessionType;
    if (sessionType === "purchase_points") {
      createPointsCheckout(session);
    } else if (sessionType === "purchase_course") {
      createBookingCheckout(session);
    }
  }

  res.status(200).json({ received: true });
};

exports.ExpertAccountDetails = asyncChoke(async (req, res, next) => {
  const { id, email } = req.user;

  const {
    country,
    routingNumber,
    accountNumber,
    accountHolderName,
    accountHolderType,
  } = req.body;

  if (
    !country ||
    !routingNumber ||
    !accountNumber ||
    !accountHolderName ||
    !accountHolderType
  )
    return next(new AppError(404, "all imputs are required"));

  try {
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: email,
        name: accountHolderName,
      });
      customerId = customer.id;
    }

    const bankAccount = await stripe.customers.createSource(customerId, {
      source: "btok_us_verified",
      // source: {
      //   object: "bank_account",
      //   country: country,
      //   currency: "usd",
      //   routing_number: routingNumber,
      //   account_number: accountNumber,
      //   account_holder_name: accountHolderName,
      //   account_holder_type: accountHolderType,
      // },
    });

    let expertAccount;
    if (bankAccount) {
      expertAccount = await create("bank_accounts", {
        Type: "bank_account",
        country,
        currency: "usd",
        routing_number: routingNumber,
        account_number: accountNumber,
        account_holder_name: accountHolderName,
        account_holder_type: accountHolderType,
        expert_id: id,
      });
    }

    res.status(200).json({
      status: "Success",
      message: "account added successfully",
      expertAccount,
    });
  } catch (err) {
    
    return next(new AppError(500, `${err.message}`));
  }
});

//get account details of expert
exports.getAccountDetails = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const [result] = await findOne("bank_accounts", { expert_id: id });

  if (!result) {
    return next(new AppError(401, "no account details found"));
  }
  res.status(200).json({
    status: "Success",
    data: result,
  });
});

//edit account details
exports.EditAccountDetails = asyncChoke(async (req, res, next) => {
  const { id, email } = req.user;

  const {
    country,
    routingNumber,
    accountNumber,
    accountHolderName,
    accountHolderType,
  } = req.body;

  try {
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else return next(new AppError(401, "no customer found"));

    // Check if the expert already has a bank account in your database
    let expertAccount = await findOne("bank_accounts", { expert_id: id });

    // If an account exists, update the existing account in Stripe
    if (expertAccount) {
      const bankAccounts = await stripe.customers.listSources(customerId, {
        object: "bank_account",
      });

      if (bankAccounts.data.length === 0) {
        return next(new AppError(401, "no bank account found"));
      }

      // const updatedBankAccount = await stripe.customers.updateSource(
      //   customerId,
      //   bankAccounts.data[0].id,
      //   {
      // Replace with actual bank account token if needed
      //   object: type,
      //   country: country,
      //   currency: currency,
      //   routing_number: routingNumber,
      //   account_number: accountNumber,
      //   account_holder_name: accountHolderName,
      //   account_holder_type: accountHolderType,
      // },
      //   }
      // );

      // Update the bank details in your database
      expertAccount = await findAndUpdate(
        "bank_accounts",
        {
          country,
          routing_number: routingNumber,
          account_number: accountNumber,
          account_holder_name: accountHolderName,
          account_holder_type: accountHolderType,
        },
        { expert_id: id }
      );
    } else
      return next(new AppError(401, "no bank details found for this expert"));

    res.status(200).json({
      status: "Success",
      message: "Account added successfully",
    });
  } catch (err) {
    console.log(err);
    return next(new AppError(500, `${err.message}`));
  }
});

exports.DeleteAccountDetails = asyncChoke(async (req, res, next) => {
  const { id, email } = req.user;

  try {
    // Get the Stripe customer based on email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else return next(new AppError(401, "No customer found"));

    let expertAccount = await findOne("bank_accounts", { expert_id: id });

    if (expertAccount) {
      const bankAccounts = await stripe.customers.listSources(customerId, {
        object: "bank_account",
      });

      if (bankAccounts.data.length === 0) {
        return next(new AppError(401, "No bank account found"));
      }

      await stripe.customers.deleteSource(customerId, bankAccounts.data[0].id);

      const query = `delete from bank_accounts where expert_id=?`;
      await pool.query(query, [id]);

      res.status(200).json({
        status: "Success",
        message: "Bank account deleted successfully",
      });
    } else {
      return next(new AppError(401, "No bank details found for this expert"));
    }
  } catch (err) {
    return next(new AppError(500, `${err.message}`));
  }
});

//CREATE PAYOUT REQUESTS
exports.createPyoutRequest = asyncChoke(async (req, res, next) => {
  const { id } = req.user;
  const { amount } = req.body;

  if (amount < 50)
    return next(new AppError(400, "You need to enter an amount greater than $50."));

  const [email] = await pool.query(`SELECT email FROM users WHERE id=?`, [id]);

  try {
    const customers = await stripe.customers.list({
      email: email[0].email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return next(new AppError(401, "Please add your bank account details first."));
    }

    const bankAccounts = await stripe.customers.listSources(customers.data[0].id, {
      object: "bank_account",
    });

    if (bankAccounts.data.length === 0) {
      return next(new AppError(401, "Please add your bank account details first."));
    }

    const payments = `
      SELECT COALESCE(FLOOR(SUM(amount - ((amount * commission_rate) / 100))), 0) AS total_amount
      FROM payments 
      JOIN courses ON payments.course_id = courses.id 
      WHERE courses.expert_id = ?;
    `;
    const [orders] = await pool.query(payments, [req.user.id]);

    const withdrawalQuery = `
      SELECT SUM(withdrawal_amount) AS total_withdrawn_amount
      FROM withdrawal
      WHERE expert_id = ?;
    `;
    const [withdrawal] = await pool.query(withdrawalQuery, [req.user.id]);

    const totalEarnings = orders[0].total_amount || 0;
    const totalWithdrawn = withdrawal[0].total_withdrawn_amount || 0;
    const payableAmount = Math.floor(totalEarnings - totalWithdrawn - 50);

    if (amount > payableAmount) {
      return next(
        new AppError(400, `You can withdraw up to $${payableAmount}. You must keep $50 in your wallet after withdrawal.`)
      );
    }

    await create("payout_requests", { expert_id: id, amount, is_paid: false });

    res.status(200).json({
      status: "Success",
      message: "Request sent successfully.",
    });
  } catch (err) {
    return next(new AppError(500, `Payout failed: ${err.message}`));
  }
});


exports.createPayout = asyncChoke(async (req, res, next) => {
  const { id } = req.params;

  const [expert] = await findById("payout_requests", id);
  if (!expert) return next(new AppError(401, "No request found with this ID"));

  const [email] = await pool.query(`SELECT email FROM users WHERE id=?`, [
    expert.expert_id,
  ]);

  try {
    const customers = await stripe.customers.list({
      email: email[0].email,
      limit: 1,
    });

    let existingBankAccount;

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      return next(new AppError(401, "please add the account details first"));
    }

    const bankAccounts = await stripe.customers.listSources(customerId, {
      object: "bank_account",
    });

    if (bankAccounts.data.length > 0) {
      existingBankAccount = bankAccounts.data[0];
    } else {
      return next(new AppError(401, "please add the account details first"));
    }

    const balance = await stripe.balance.retrieve();
    console.log("Current Balance:", balance);

    const Payout = await stripe.payouts.create({
      amount: Math.round(expert.amount * 100),
      currency: "usd",
      destination: existingBankAccount.id,
      metadata: {
        expert_id: expert.expert_id,
        payout_req: id,
      },
    });

    res.status(200).json({
      status: "Success",
      Payout,
    });
  } catch (err) {
    return next(new AppError(500, `Payout failed: ${err.message}`));
  }
});

exports.webhookPayout = asyncChoke(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.WEBHOOK_PAYOUT;
  console.log("i am here");
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed.");
    return res.sendStatus(400);
  }

  switch (event.type) {
    case "payout.created":
      const payoutcreated = event.data.object;
      console.log(payoutcreated);
      createPayoutEntry(payoutcreated);

    case "payout.paid":
      const payoutPaid = event.data.object;

      await findAndUpdate(
        "withdrawal",
        { withdrawal_status: "success" },
        { transaction_id: payoutPaid.balance_transaction }
      );
      await findAndUpdate(
        "payout_requests",
        { is_paid: true },
        { id: payoutPaid.metadata.payout_req }
      );
      break;

    case "payout.failed":
      const payoutFailed = event.data.object;
      await findAndUpdate(
        "withdrawal",
        { withdrawal_status: "failed" },
        { transaction_id: payoutFailed.balance_transaction }
      );
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

const createPayoutEntry = async (payout) => {
  const createdAt = new Date(payout.created * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  await create("withdrawal", {
    withdrawal_amount: payout.amount / 100,
    withdrawal_date: createdAt,
    transaction_id: payout.balance_transaction,
    expert_id: payout.metadata.expert_id,
    withdrawal_status: payout.status,
  });
};
