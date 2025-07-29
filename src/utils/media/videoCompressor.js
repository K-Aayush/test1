const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");

class VideoCompressor {
  constructor() {
    this.compressionSettings = {
      // Compression profiles for different use cases
      course: {
        videoBitrate: "1000k",
        audioBitrate: "128k",
        scale: "1280:720", // 720p max
        crf: 28, // Constant Rate Factor (lower = better quality, higher = smaller file)
        preset: "medium",
        format: "mp4",
        codec: "libx264",
      },
      content: {
        videoBitrate: "800k",
        audioBitrate: "96k",
        scale: "854:480", // 480p max
        crf: 30,
        preset: "fast",
        format: "mp4",
        codec: "libx264",
      },
      reel: {
        videoBitrate: "600k",
        audioBitrate: "64k",
        scale: "720:1280", // Vertical format for reels
        crf: 32,
        preset: "fast",
        format: "mp4",
        codec: "libx264",
      },
    };
  }

  // Compress video file
  async compressVideo(inputPath, outputPath, profile = "course", options = {}) {
    try {
      console.log(`Starting video compression: ${inputPath} -> ${outputPath}`);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      const settings = { ...this.compressionSettings[profile], ...options };

      return new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .videoBitrate(settings.videoBitrate)
          .audioBitrate(settings.audioBitrate)
          .videoCodec(settings.codec)
          .audioCodec("aac")
          .format(settings.format)
          .addOptions([
            `-crf ${settings.crf}`,
            `-preset ${settings.preset}`,
            `-movflags +faststart`, // Optimize for web streaming
            `-pix_fmt yuv420p`, // Ensure compatibility
          ]);

        // Apply scaling if specified
        if (settings.scale && settings.scale !== "original") {
          command.size(settings.scale);
        }

        command
          .output(outputPath)
          .on("start", (commandLine) => {
            console.log("FFmpeg command:", commandLine);
          })
          .on("progress", (progress) => {
            console.log(
              `Compression progress: ${Math.round(progress.percent || 0)}%`
            );
          })
          .on("end", async () => {
            try {
              const originalStats = await fs.stat(inputPath);
              const compressedStats = await fs.stat(outputPath);
              const compressionRatio = (
                ((originalStats.size - compressedStats.size) /
                  originalStats.size) *
                100
              ).toFixed(2);

              console.log(`Video compression completed successfully`);
              console.log(
                `Original size: ${(originalStats.size / 1024 / 1024).toFixed(
                  2
                )} MB`
              );
              console.log(
                `Compressed size: ${(
                  compressedStats.size /
                  1024 /
                  1024
                ).toFixed(2)} MB`
              );
              console.log(`Compression ratio: ${compressionRatio}%`);

              resolve({
                success: true,
                originalSize: originalStats.size,
                compressedSize: compressedStats.size,
                compressionRatio: parseFloat(compressionRatio),
                outputPath,
              });
            } catch (error) {
              console.error("Error getting file stats:", error);
              resolve({
                success: true,
                outputPath,
                originalSize: 0,
                compressedSize: 0,
                compressionRatio: 0,
              });
            }
          })
          .on("error", (err) => {
            console.error("Video compression error:", err);
            reject(err);
          })
          .run();
      });
    } catch (error) {
      console.error("Video compression setup error:", error);
      throw error;
    }
  }

  // Get video info before compression
  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === "video"
        );
        const audioStream = metadata.streams.find(
          (stream) => stream.codec_type === "audio"
        );

        resolve({
          duration: metadata.format.duration || 0,
          size: metadata.format.size || 0,
          bitrate: metadata.format.bit_rate || 0,
          video: videoStream
            ? {
                width: videoStream.width || 0,
                height: videoStream.height || 0,
                codec: videoStream.codec_name || "unknown",
                bitrate: videoStream.bit_rate || 0,
              }
            : null,
          audio: audioStream
            ? {
                codec: audioStream.codec_name || "unknown",
                bitrate: audioStream.bit_rate || 0,
                sampleRate: audioStream.sample_rate || 0,
              }
            : null,
        });
      });
    });
  }

  // Determine optimal compression profile based on video characteristics
  async determineOptimalProfile(videoPath, targetUse = "course") {
    try {
      const info = await this.getVideoInfo(videoPath);
      const fileSizeMB = info.size / 1024 / 1024;
      const duration = info.duration;
      const width = info.video?.width || 0;
      const height = info.video?.height || 0;

      // Determine if it's vertical video (reel-style)
      const isVertical = height > width;

      // Choose profile based on characteristics
      if (isVertical && duration <= 60) {
        return "reel";
      } else if (targetUse === "content" || fileSizeMB < 100) {
        return "content";
      } else {
        return "course";
      }
    } catch (error) {
      console.error("Error determining optimal profile:", error);
      return targetUse;
    }
  }

  // Compress video with automatic profile selection
  async compressVideoAuto(
    inputPath,
    outputPath,
    targetUse = "course",
    maxSizeMB = 50
  ) {
    try {
      const profile = await this.determineOptimalProfile(inputPath, targetUse);
      console.log(`Using compression profile: ${profile}`);

      let result = await this.compressVideo(inputPath, outputPath, profile);

      // If still too large, apply more aggressive compression
      if (result.compressedSize / 1024 / 1024 > maxSizeMB) {
        console.log(
          `File still too large (${(
            result.compressedSize /
            1024 /
            1024
          ).toFixed(2)} MB), applying aggressive compression...`
        );

        const aggressiveSettings = {
          videoBitrate: "500k",
          audioBitrate: "64k",
          crf: 35,
          preset: "fast",
        };

        result = await this.compressVideo(
          inputPath,
          outputPath,
          profile,
          aggressiveSettings
        );
      }

      return result;
    } catch (error) {
      console.error("Auto compression error:", error);
      throw error;
    }
  }

  // Extract/decompress video (for viewing)
  async extractVideo(compressedPath, outputPath, quality = "original") {
    try {
      console.log(`Extracting video: ${compressedPath} -> ${outputPath}`);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // For now, we'll just copy the compressed video as it's already optimized
      // In a more advanced system, you could have multiple quality versions
      await fs.copyFile(compressedPath, outputPath);

      return {
        success: true,
        outputPath,
        quality,
      };
    } catch (error) {
      console.error("Video extraction error:", error);
      throw error;
    }
  }

  // Clean up temporary files
  async cleanup(filePaths) {
    for (const filePath of filePaths) {
      try {
        if (fsSync.existsSync(filePath)) {
          await fs.unlink(filePath);
          console.log(`Cleaned up temporary file: ${filePath}`);
        }
      } catch (error) {
        console.error(`Error cleaning up file ${filePath}:`, error);
      }
    }
  }

  // Get compression statistics
  getCompressionStats(originalSize, compressedSize) {
    const ratio = (
      ((originalSize - compressedSize) / originalSize) *
      100
    ).toFixed(2);
    return {
      originalSizeMB: (originalSize / 1024 / 1024).toFixed(2),
      compressedSizeMB: (compressedSize / 1024 / 1024).toFixed(2),
      compressionRatio: parseFloat(ratio),
      spaceSavedMB: ((originalSize - compressedSize) / 1024 / 1024).toFixed(2),
    };
  }
}

module.exports = new VideoCompressor();
