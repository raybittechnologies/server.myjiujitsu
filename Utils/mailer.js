const nodeMailer = require("nodemailer");
const path = require("path");

module.exports = class Email {
  constructor(email, uri, name) {
    this.to = email;
    this.name = name;
    this.uri = uri;
    this.from = `Juijitsu <${process.env.EMAIL_FROM}>`;
  }

  // newTransporter() {
  //   return nodeMailer.createTransport({
  //     host: "smtp-relay.brevo.com",
  //     port: 587,
  //     secure: false,
  //     auth: {
  //       user: process.env.BREVO_USERNAME,
  //       pass: process.env.BREVO_PASSWORD,
  //     },
  //   });
  // }

  newTransporter() {
    return nodeMailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USERNAME, // Your Gmail email address
        pass: process.env.GMAIL_PASSWORD, // Your Gmail password or App Password
      },
    });
  }

  async sendEmail(template, subject) {
    let mailOPtions;
    if (template === "passwordReset") {
      mailOPtions = {
        from: this.from,
        to: this.to,
        html: `
     <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body {
      font-family: sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }

    .container {
      max-width: 600px;
      margin: 50px auto;
      background-color: #fff;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }

    h1 {
      text-align: center;
      font-size: 2.5rem;
      color: #333;
      margin-bottom: 20px;
    }

    p {
      line-height: 1.6;
      color: #555;
      margin-bottom: 15px;
    }

    .button {
      display: block;
      width: 50%;
      padding: 15px 20px;
      background: linear-gradient(to right, #0C243C 0%, #7E8C9C 100%);
      color: #fff;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.3s ease;
      text-align: center;
      text-decoration: none;
    }

    .button:hover {
      background: linear-gradient(to right, #0A1D2C 0%, #6E7F8D 100%); /* Slightly different gradient on hover */
    }

    .link {
      display: block;
      text-align: center;
      margin-top: 20px;
      color: #007bff;
      text-decoration: none;
    }

    .link:hover {
      text-decoration: underline;
    }

    .support-link {
      display: block;
      text-align: center;
      margin-top: 10px;
      color: #555;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reset your Password 👋</h1>
    <p>Hi ${this.name}!</p>
    <p>We received a request to reset your password for your Juijitsux account. No worries, we've got you covered! Simply click the button below to set up a new password.</p>
    <a href="${this.uri}" class="button">  <p style="margin: 0; padding: 0; color: #fff;">Click here to Reset Password!</p></a>
    <p>For your security, this link will expire in 24 hours.<br /> If you didn't request a password reset, you can safely ignore this email—your account will remain secure. If you have any questions or need further assistance, feel free to contact our support team at <a href="mailto:help@jiujitsux.com">help@jiujitsux.com</a>.</p>
  </div>
</body>
</html>

      `,
        subject,
      };
    }
    if (template === "welcome") {
      mailOPtions = {
        from: this.from,
        to: this.to,
        html: `
   <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f4f4f4;
    }
    .email-container {
        max-width: 800px;
        margin: 20px auto;
        background: #ffffff;
        padding: 20px;
        text-align: center;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .email-header {
        color: #333;
        margin-bottom: 20px;
    }
    .email-body {
        margin-bottom: 20px;
        line-height: 1.6;
        color: #555;
        padding: 0 15px;
    }
    .button {
        display: inline-block;
        padding: 15px 20px;
        background: linear-gradient(to right, #0C243C 0%, #7E8C9C 100%);
        color: #fff;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: background 0.3s ease;
        text-align: center;
        text-decoration: none;
        font-size: 16px;
        font-weight: bold;
        margin: 10px auto;
    }
    .email-footer {
        font-size: 12px;
        color: #777;
        padding: 10px;
    }
    .email-footer a {
        color: #0C243C;
        text-decoration: none;
        font-weight: bold;
    }
    
    /* Responsive Design */
    @media screen and (max-width: 600px) {
        .email-container {
            width: 90%;
            padding: 15px;
        }
        .button {
            width: 100%;
            font-size: 14px;
            padding: 12px;
        }
    }
</style>
</head>
<body>
<div class="email-container">
    <div class="email-header">
        <h1>Welcome ${this.name} 👋</h1>
    </div>
    <div class="email-body">
        <p>Welcome to My JiuJitsux!</p>
        <p>We're excited to have you on board. To get started and fully access our e-learning platform, we need to verify your email address. Please click the link below to confirm your email:</p>
        <a href="${this.uri}" class="button">Click here to verify!</a>
        <p>Once your email is verified, you'll have access to a wealth of JiuJitsux training resources, tutorials, and community support.</p>
    </div>
    <div class="email-footer">
        <p>Best regards,<br>The JiuJitsux Team</p>
        <p><a href="http://www.myjiujitsu.com">www.myjiujitsu.com</a><br>
           <a href="mailto:help@jiuJitsux.com">help@jiuJitsux.com</a></p>
    </div>
</div>
</body>
</html>

  `,
      };
    }

    if (template === "expert") {
      mailOPtions = {
        from: this.from,
        to: this.to,
        html: `
    <!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f4f4f4;
    }
    .email-container {
        max-width: 800px;
        margin: 20px auto;
        background: #ffffff;
        padding: 20px;
        text-align: center;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .email-header {
        color: #333;
        margin-bottom: 20px;
    }
    .email-body {
        margin-bottom: 20px;
        line-height: 1.6;
        color: #555;
    }
    .button {
      display: block;
      width: 50%;
      padding: 15px 20px;
      background: linear-gradient(to right, #0C243C 0%, #7E8C9C 100%);
      color: #fff;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.3s ease;
      text-align: center;
      text-decoration: none;
    }
    .email-footer {
        font-size: 12px;
        color: #777;
    }
</style>
</head>
<body>
<div class="email-container">
    <div class="email-header">
        <h1>Welcome ${this.name} 👋</h1>
    </div>
    <div class="email-body">
        <p>Welcome to JiuJitsux!</p>
        <p>Your expert account has been successfully created.</p>
        <p> Here are your login credentials:
       ${this.uri}
    </p>
    <p>Please log in and update your password to ensure your account's security.</p>
    </div>
    <div class="email-footer">
    <p>If you have any questions, feel free to contact us. </p>.
        <p>Best regards,<br>The JiuJitsux Team</p>
        <p><a href="http://www.jiuJitsux.com">www.jiuJitsux.com</a><br><a href="mailto:help@jiuJitsux.com">help@jiuJitsux.com</a></p>
    </div>
</div>
</body>
</html>

  `,
      };
    }

    await this.newTransporter().sendMail(mailOPtions);
  }

  async sendWelcome() {
    await this.sendEmail("welcome", "Welcome to Juijitsu");
  }

  async sendPasswordReset() {
    await this.sendEmail("passwordReset", "Reset your password");
  }

  async sendExpertWelcome() {
    await this.sendEmail("expert", "Welcome to Juijitsu");
  }
};
