const { mkdirSync } = require("fs");
const multer = require("multer");
const path = require("path");
const VideoCompressor = require("../media/videoCompressor");
const fs = require("fs");

// Create Multer storage engine
const storage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const subfolder = req?.query?.subfolder || "";

      if (!folder) {
        return cb(new Error("User "), null);
      }

      // Full local path
      const fullPath = path.join(process.cwd(), "courses", folder, subfolder);

      try {
        mkdirSync(fullPath, { recursive: true });
        // Create compressed videos directory
        mkdirSync(path.join(fullPath, "compressed"), { recursive: true });
        mkdirSync(path.join(fullPath, "original"), { recursive: true });
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

    filename: async (req, file, cb) => {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1e6);
      const ext = path.extname(file.originalname);
      const safeName =
        req?.query?.filename ||
        `${file.fieldname}-${timestamp}-${random}${ext}`;

      const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(ext);

      if (isVideo) {
        // For videos, save to original folder first, then compress
        const originalPath = path
          .join(req.destination, "original", safeName)
          .replaceAll("//", "/");
        const compressedName = `compressed_${safeName.replace(ext, ".mp4")}`;
        const compressedPath = path
          .join(req.destination, "compressed", compressedName)
          .replaceAll("//", "/");

        // Save the compressed path as the main file location
        req.file_location = compressedPath;
        req.original_file_location = originalPath;
        req.needs_compression = true;
        req.compression_info = {
          originalName: safeName,
          compressedName: compressedName,
          originalPath: originalPath,
          compressedPath: compressedPath,
        };

        // Save to original folder first
        cb(null, path.join("original", safeName));
      } else {
        // For non-videos, save normally
        req.file_location = `${req.destination}/${safeName}`.replaceAll(
          "//",
          "/"
        );
        cb(null, safeName);
      }

      console.log(req?.file_locations);
      const oldlocations = Array?.isArray(req?.file_locations)
        ? req?.file_locations
        : [];

      console.log("Old locations : ", oldlocations);

      oldlocations.push(req.file_location);
      req.file_locations = oldlocations;
    },
  });

// Post-processing middleware for video compression
const processVideoCompression = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    const compressionPromises = [];
    const tempFiles = [];

    for (const file of req.files) {
      if (req.needs_compression && req.compression_info) {
        const originalFullPath = path.join(
          process.cwd(),
          req.compression_info.originalPath.substring(1)
        );
        const compressedFullPath = path.join(
          process.cwd(),
          req.compression_info.compressedPath.substring(1)
        );

        console.log(`Starting compression for: ${originalFullPath}`);

        // Add to temp files for cleanup
        tempFiles.push(originalFullPath);

        // Compress the video
        const compressionPromise = VideoCompressor.compressVideoAuto(
          originalFullPath,
          compressedFullPath,
          "course",
          50 // Max 50MB after compression
        )
          .then((result) => {
            console.log(`Compression completed:`, result);
            return result;
          })
          .catch((error) => {
            console.error(`Compression failed for ${originalFullPath}:`, error);
            // If compression fails, copy original file
            return fs.promises
              .copyFile(originalFullPath, compressedFullPath)
              .then(() => ({
                success: true,
                outputPath: compressedFullPath,
                originalSize: 0,
                compressedSize: 0,
                compressionRatio: 0,
                error: "Compression failed, using original file",
              }));
          });

        compressionPromises.push(compressionPromise);
      }
    }

    // Wait for all compressions to complete
    if (compressionPromises.length > 0) {
      const results = await Promise.all(compressionPromises);
      console.log("All video compressions completed:", results);

      // Clean up original files after successful compression
      setTimeout(async () => {
        await VideoCompressor.cleanup(tempFiles);
      }, 5000); // Wait 5 seconds before cleanup
    }

    next();
  } catch (error) {
    console.error("Video compression middleware error:", error);
    next(); // Continue even if compression fails
  }
};
const AdminFiles = (folder) => {
  const upload = multer({
    storage: storage(folder),
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB limit for original files
      files: 10,
    },
    fileFilter: (req, file, cb) => {
      // Allow videos, images, and documents
      const allowedTypes =
        /jpeg|jpg|png|gif|webp|mp4|mov|avi|webm|mkv|pdf|doc|docx|txt/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype =
        allowedTypes.test(file.mimetype) ||
        file.mimetype.startsWith("video/") ||
        file.mimetype.startsWith("image/") ||
        file.mimetype.includes("document");

      if (extname && (mimetype || file.mimetype.startsWith("video/"))) {
        return cb(null, true);
      }
      cb(new Error("Only images, videos, and documents are allowed"), false);
    },
  });

  // Return multer instance with compression middleware
  return {
    ...upload,
    processCompression: processVideoCompression,
  };
};

module.exports = AdminFiles;
