const redis = require("../../config/connectRedis");
const GenRes = require("../routers/GenRes");
const transporter = require("../../config/Mailer");
// Send OTP
const setCode = async (email) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000);
    const key = `otp:${email}`;
    const value = JSON.stringify({ code: otp, count: 0 });

    // Set OTP with expiry
    await redis.setEx(key, 300, value); // 300 seconds = 5 mins

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: "Your OTP Code",
      html: `<p>Your OTP code is <strong>${otp}</strong>. It will expire in 5 minutes.</p><p>Do not share this with anyone.</p>`,
    });

    return GenRes(200, null, null, "Otp sent!");
  } catch (err) {
    return GenRes(500, null, err, err?.message);
  }
};

// Verify OTP
const verifyCode = async (email, code) => {
  try {
    const key = `otp:${email}`;
    const data = await redis.get(key);

    if (!data) {
      return GenRes(
        404,
        null,
        { error: "Token Not Found." },
        "Token may be expired!"
      );
    }

    const parsed = JSON.parse(data);
    const userCode = parseInt(code, 10);

    if (parsed.code !== userCode) {
      parsed.count += 1;

      if (parsed.count >= 5) {
        await redis.del(key);
        return GenRes(
          403,
          null,
          { error: "Too many incorrect attempts" },
          "OTP blocked"
        );
      } else {
        await redis.setEx(key, 300, JSON.stringify(parsed));
        return GenRes(
          401,
          null,
          { error: "Incorrect code" },
          `Incorrect OTP! Attempts left: ${5 - parsed.count}`
        );
      }
    }

    await redis.del(key); // One-time use
    return GenRes(200, null, null, "OTP verified successfully");
  } catch (err) {
    return GenRes(500, null, err, err?.message);
  }
};

module.exports = { setCode, verifyCode };
