const passport = require("passport");
const { findOne } = require("../Controllers/handlerFactory");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL:
        "https://elearn-pv2m.onrender.com/api/v1/auth/google/callback",
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        return done(null, profile);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

// select * from lessons join chapters on lessons.chapter_id=chapters.id join courses on
// courses.id=chapters.course_id where course_id=11 order by lessons.sequence
