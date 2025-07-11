const { mkdirSync } = require("fs");
const multer = require("multer");
const path = require("path");

// Create Multer storage engine
const storage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const subfolder = req?.query?.subfolder || "";

      if (!folder) {
        return cb(
          new Error("User "),
          null
        );
      }

      // Full local path
      const fullPath = path.join(process.cwd(), "courses", folder, subfolder);

      try {
        mkdirSync(fullPath, { recursive: true });
      } catch (err) {
        return cb(
          new Error(`Failed to create directory: ${err.message}`),
          null
        );
      }

      // Save server-relative destination path for use in filename
      req.destination = `/courses/${folder}/${subfolder}`.replaceAll("//", "/");
      cb(null, fullPath);
    },

    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1e6);
      const ext = path.extname(file.originalname);
      const safeName =
        req?.query?.filename ||
        `${file.fieldname}-${timestamp}-${random}${ext}`;

      // Save final full relative path for use later
      req.file_location = `${req.destination}/${safeName}`.replaceAll("//", "/");

      console.log(req?.file_locations);
      const oldlocations = Array?.isArray(req?.file_locations)
        ? req?.file_locations
        : [];

      console.log("Old locations : ", oldlocations);

      oldlocations.push(`${req.destination}/${safeName}`.replaceAll("//", "/"));
      req.file_locations = oldlocations;
      cb(null, safeName);
    },
  });

const AdminFiles = (folder) =>
  multer({ storage: storage(folder), limits: 150 * 1024 * 1024 * 1024 });

module.exports = AdminFiles;
