const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const GenRes = require("../../utils/routers/GenRes");

const AccessPrivateFiles = async (req, res) => {
  try {
    const { subfolder, filename } = req.params;
    const filePath = path.join(
      process.cwd(),
      "courses",
      "private",
      subfolder,
      filename
    );

    // Security check: prevent path traversal
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(path.join(process.cwd(), "courses", "private"))) {
      throw new Error("Unauthorized access to file.");
    }

    const file = await fs.promises.readFile(normalizedPath);
    const mimeType = mime.lookup(filename) || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.status(200).send(file);
  } catch (error) {
    const response = GenRes.errorResponse(error.message, 500);
    res.status(500).json(response);
  }
};

module.exports = { AccessPrivateFiles };
