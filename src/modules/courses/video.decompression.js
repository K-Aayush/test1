const VideoCompressor = require("../../utils/media/videoCompressor");
const path = require("path");
const fs = require("fs");
const GenRes = require("../../utils/routers/GenRes");

// Decompress/extract video for viewing
const DecompressVideo = async (req, res) => {
  try {
    const { videoPath, quality = "original" } = req.body;
    const user = req.user;

    if (!videoPath) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Video path required" },
            "Video path is required"
          )
        );
    }

    // Security check: ensure the video path is within allowed directories
    const normalizedPath = path.normalize(videoPath);
    const allowedPaths = [
      path.join(process.cwd(), "courses"),
      path.join(process.cwd(), "uploads"),
    ];

    const isAllowed = allowedPaths.some((allowedPath) =>
      normalizedPath.startsWith(allowedPath)
    );

    if (!isAllowed) {
      return res
        .status(403)
        .json(
          GenRes(
            403,
            null,
            { error: "Access denied" },
            "Unauthorized file access"
          )
        );
    }

    // Check if compressed video exists
    const compressedPath = path.join(process.cwd(), videoPath.substring(1));
    if (!fs.existsSync(compressedPath)) {
      return res
        .status(404)
        .json(
          GenRes(
            404,
            null,
            { error: "Video not found" },
            "Compressed video file not found"
          )
        );
    }

    // For now, we'll serve the compressed video directly
    // In a more advanced system, you could decompress to different qualities
    const videoStats = fs.statSync(compressedPath);

    // Set appropriate headers for video streaming
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", videoStats.size);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");

    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoStats.size - 1;
      const chunksize = end - start + 1;

      res.status(206);
      res.setHeader(
        "Content-Range",
        `bytes ${start}-${end}/${videoStats.size}`
      );
      res.setHeader("Content-Length", chunksize);

      const stream = fs.createReadStream(compressedPath, { start, end });
      stream.pipe(res);
    } else {
      // Serve entire video
      const stream = fs.createReadStream(compressedPath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error("Video decompression error:", error);
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

// Get video info and compression stats
const GetVideoInfo = async (req, res) => {
  try {
    const { videoPath } = req.query;

    if (!videoPath) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Video path required" },
            "Video path is required"
          )
        );
    }

    const compressedPath = path.join(process.cwd(), videoPath.substring(1));

    if (!fs.existsSync(compressedPath)) {
      return res
        .status(404)
        .json(
          GenRes(
            404,
            null,
            { error: "Video not found" },
            "Video file not found"
          )
        );
    }

    // Get video information
    const videoInfo = await VideoCompressor.getVideoInfo(compressedPath);
    const fileStats = fs.statSync(compressedPath);

    const response = {
      path: videoPath,
      size: fileStats.size,
      sizeMB: (fileStats.size / 1024 / 1024).toFixed(2),
      duration: videoInfo.duration,
      video: videoInfo.video,
      audio: videoInfo.audio,
      format: videoInfo.format,
      isCompressed: videoPath.includes("compressed"),
      streamingUrl: videoPath,
    };

    return res
      .status(200)
      .json(GenRes(200, response, null, "Video info retrieved successfully"));
  } catch (error) {
    console.error("Get video info error:", error);
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

// Stream video with range support
const StreamVideo = async (req, res) => {
  try {
    const { videoPath } = req.params;

    // Security check
    const normalizedPath = path.normalize(videoPath);
    const allowedPaths = [
      path.join(process.cwd(), "courses"),
      path.join(process.cwd(), "uploads"),
    ];

    const isAllowed = allowedPaths.some((allowedPath) =>
      normalizedPath.startsWith(allowedPath)
    );

    if (!isAllowed) {
      return res
        .status(403)
        .json(
          GenRes(
            403,
            null,
            { error: "Access denied" },
            "Unauthorized file access"
          )
        );
    }

    const fullPath = path.join(process.cwd(), videoPath);

    if (!fs.existsSync(fullPath)) {
      return res
        .status(404)
        .json(
          GenRes(
            404,
            null,
            { error: "Video not found" },
            "Video file not found"
          )
        );
    }

    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Handle range requests for video seeking
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600",
      });

      const stream = fs.createReadStream(fullPath, { start, end });
      stream.pipe(res);
    } else {
      // Serve entire video
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      });

      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error("Video streaming error:", error);
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

module.exports = {
  DecompressVideo,
  GetVideoInfo,
  StreamVideo,
};
