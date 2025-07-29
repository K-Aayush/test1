const path = require("path");
const fs = require("fs");
const User = require("./user.model");
const GenRes = require("../../utils/routers/GenRes");
const { isValidObjectId } = require("mongoose");

const GetProfilePicture = async (req, res) => {
  try {
    const { email, userId } = req.query;

    // Validate input - at least one parameter is required
    if (!email && !userId) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Missing parameters" },
            "Either email or userId is required"
          )
        );
    }

    // Validate userId if provided
    if (userId && !isValidObjectId(userId)) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Invalid user ID" },
            "Invalid user ID format"
          )
        );
    }

    // Build query based on provided parameters
    let query = {};
    if (userId) {
      query._id = userId;
    } else if (email) {
      query.email = email.toLowerCase();
    }

    // Find user and get profile picture path
    const user = await User.findOne(query).select("picture email").lean();

    if (!user) {
      return res
        .status(404)
        .json(GenRes(404, null, { error: "User not found" }, "User not found"));
    }

    // Check if user has a profile picture
    if (!user.picture) {
      return res
        .status(404)
        .json(
          GenRes(
            404,
            null,
            { error: "No profile picture" },
            "User has no profile picture"
          )
        );
    }

    // Construct file path
    const filePath = path.join(process.cwd(), user.picture.slice(1));

    // Security check: prevent path traversal
    const normalizedPath = path.normalize(filePath);
    const uploadsDir = path.join(process.cwd(), "uploads");

    if (!normalizedPath.startsWith(uploadsDir)) {
      return res
        .status(403)
        .json(
          GenRes(
            403,
            null,
            { error: "Unauthorized access" },
            "Unauthorized file access"
          )
        );
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      return res
        .status(404)
        .json(
          GenRes(
            404,
            null,
            { error: "File not found" },
            "Profile picture file not found"
          )
        );
    }

    // Get file stats for headers
    const stats = fs.statSync(normalizedPath);
    const fileExtension = path.extname(normalizedPath).toLowerCase();

    // Determine content type based on file extension
    let contentType = "application/octet-stream";
    switch (fileExtension) {
      case ".jpg":
      case ".jpeg":
        contentType = "image/jpeg";
        break;
      case ".png":
        contentType = "image/png";
        break;
      case ".gif":
        contentType = "image/gif";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
      case ".bmp":
        contentType = "image/bmp";
        break;
    }

    // Set appropriate headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Cache-Control", "public, max-age=86400"); 
    res.setHeader("Last-Modified", stats.mtime.toUTCString());

    // Set filename for download
    const filename = `profile_${user.email.split("@")[0]}${fileExtension}`;
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(normalizedPath);

    fileStream.on("error", (error) => {
      console.error("Error streaming profile picture:", error);
      if (!res.headersSent) {
        return res
          .status(500)
          .json(
            GenRes(
              500,
              null,
              { error: "File stream error" },
              "Error serving profile picture"
            )
          );
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error("Error getting profile picture:", error);
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

// Get profile picture info (metadata only, not the file)
const GetProfilePictureInfo = async (req, res) => {
  try {
    const { email, userId } = req.query;

    // Validate input
    if (!email && !userId) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Missing parameters" },
            "Either email or userId is required"
          )
        );
    }

    // Validate userId if provided
    if (userId && !isValidObjectId(userId)) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Invalid user ID" },
            "Invalid user ID format"
          )
        );
    }

    // Build query
    let query = {};
    if (userId) {
      query._id = userId;
    } else if (email) {
      query.email = email.toLowerCase();
    }

    // Find user
    const user = await User.findOne(query).select("picture email name").lean();

    if (!user) {
      return res
        .status(404)
        .json(GenRes(404, null, { error: "User not found" }, "User not found"));
    }

    // Prepare response data
    const responseData = {
      hasProfilePicture: !!user.picture,
      profilePictureUrl: user.picture || null,
      user: {
        email: user.email,
        name: user.name,
      },
    };

    // If user has profile picture, get file info
    if (user.picture) {
      const filePath = path.join(process.cwd(), user.picture.slice(1));

      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();

        responseData.fileInfo = {
          size: stats.size,
          lastModified: stats.mtime,
          extension: fileExtension,
          exists: true,
        };
      } else {
        responseData.fileInfo = {
          exists: false,
        };
      }
    }

    return res
      .status(200)
      .json(
        GenRes(
          200,
          responseData,
          null,
          "Profile picture info retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error getting profile picture info:", error);
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

module.exports = {
  GetProfilePicture,
  GetProfilePictureInfo,
};
