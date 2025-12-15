import multer from "multer";
import path from "path";
import fs from "fs";

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "uploads/"); // make sure this folder exists
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (!file.originalname.endsWith(".csv")) {
      return cb(new Error("Only CSV files are allowed"));
    }
    cb(null, true);
  },
});
