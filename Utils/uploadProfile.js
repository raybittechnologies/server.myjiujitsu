// const multer = require("multer");
// const AppError = require("./error");

// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "public/profilePictures");
//   },
//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split("/")[1];
//     cb(null, `user-${Date.now()}.${ext}`);
//   },
// });

// const multerFilter = (req, file, cb) => {
//   if (file.mimetype.startsWith("image")) {
//     cb(null, true);
//   } else {
//     cb(new AppError(400, "not an image!please upload only images"), false);
//   }
// };

// const upload = multer({
//   storage: multerStorage,
//   fileFilter: multerFilter,
// });
// exports.uploadUserPhotos = upload.single("profile_picture");
// exports.uploadThumbnail = upload.single("thumbnail");

const { S3 } = require("@aws-sdk/client-s3");
const { asyncChoke } = require("./asyncWrapper");

exports.uploadFile = asyncChoke(async (file) => {
  const s3 = new S3({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET,
    },
  });

  const buffer = file[0].buffer;
  const mimeType = file[0].mimetype;

  let fileType = "image";
  let extension = ".png";
  let contentType = "image/png";
  let folder = "images";

  if (mimeType.startsWith("video/")) {
    fileType = "video";
    extension = ".mp4";
    contentType = mimeType;
    folder = "videos";
  }

  const uploadParams = {
    Bucket: "myjiujitsu",
    Key: `${folder}/${fileType}-${Date.now()}${extension}`,
    Body: buffer,
    ContentType: contentType,
  };

  try {
    await s3.putObject(uploadParams);
    const url = `https://myjiujitsu.s3.us-east-1.amazonaws.com/${uploadParams.Key}`;
    return url;
  } catch (error) {
    console.error("Error uploading file: ", error);
    throw error;
  }
});
