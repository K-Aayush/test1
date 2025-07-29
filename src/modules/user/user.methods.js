const User = require("./user.model");
const Content = require("../contents/contents.model");
const Report = require("./report.model");
const Support = require("./support.model");
const { setCode, verifyCode } = require("../../utils/auth/changePass");
const bcrypt = require("bcryptjs");
const GenRes = require("../../utils/routers/GenRes");
const Follow = require("../follow/follow.model");
const Like = require("../likes/likes.model");
const Comment = require("../comments/comments.model");
const { isValidObjectId } = require("mongoose");
const FCMHandler = require("../../utils/notification/fcmHandler");

// Get user content
const GetUserContent = async (req, res) => {
  try {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 0;
    const limit = 10;

    if (!isValidObjectId(userId)) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Invalid user ID" },
            "Invalid user ID provided"
          )
        );
    }

    const user = await User.findById(userId).select("email name picture");
    if (!user) {
      return res
        .status(404)
        .json(GenRes(404, null, { error: "User not found" }, "User not found"));
    }

    const [contents, totalPosts] = await Promise.all([
      Content.find({ "author._id": userId })
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean(),
      Content.countDocuments({ "author._id": userId }),
    ]);

    // Enrich content with likes and comments count
    const enrichedContents = await Promise.all(
      contents.map(async (content) => {
        const [likes, comments] = await Promise.all([
          Like.countDocuments({ uid: content._id, type: "content" }),
          Comment.countDocuments({ uid: content._id, type: "content" }),
        ]);

        const liked = req.user
          ? await Like.findOne({
              uid: content._id,
              type: "content",
              "user.email": req.user.email,
            })
          : null;

        return {
          ...content,
          likes,
          comments,
          liked: !!liked,
        };
      })
    );

    return res.status(200).json(
      GenRes(
        200,
        {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            picture: user.picture,
          },
          contents: enrichedContents,
          pagination: {
            page,
            totalPages: Math.ceil(totalPosts / limit),
            totalPosts,
            hasMore: (page + 1) * limit < totalPosts,
          },
        },
        null,
        "User content retrieved successfully"
      )
    );
  } catch (error) {
    return res.status(500).json(GenRes(500, null, error, error.message));
  }
};

// check if user exists
const UserExist = async (req, res) => {
  try {
    const data = await User.findOne({
      email: req?.query?.email?.toLowerCase(),
    });
    if (data) {
      const response = GenRes(200, data, null, "Exists");
      return res.status(200).json(response);
    }
    const response = GenRes(
      404,
      null,
      { error: "User Not Found" },
      "Doesnot Exist"
    );
    return res.status(404).json(response);
  } catch (error) {
    const response = GenRes(500, null, error, error?.message);
    return response;
  }
};

// get all users
const GetAllUsers = async (req, res) => {
  try {
    const data = await User.find()
      .select("-password -refreshToken -role -signedIn -createdAt")
      .lean();

    if (!data || data.length === 0) {
      return res
        .status(404)
        .json(GenRes(404, null, { error: "No users found!" }, "Not found"));
    }

    // Add follower and following counts for each user
    const users = await Promise.all(
      data.map(async (user) => {
        const followers = await Follow.countDocuments({
          "following._id": user._id,
        });
        const following = await Follow.countDocuments({
          "follower._id": user._id,
        });
        return {
          ...user,
          followers,
          following,
        };
      })
    );

    return res
      .status(200)
      .json(GenRes(200, users, null, "All Users Retrieved"));
  } catch (error) {
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

// get profile
const UserProfile = async (req, res) => {
  try {
    const { uid, _id } = req?.user;

    const userQuery = uid ? { uid } : { _id };

    const data = await User.findOne(userQuery).lean();

    if (!data) {
      return res
        .status(404)
        .json(GenRes(404, null, { error: "User not found!" }, "Not found"));
    }

    delete data.refreshToken;
    delete data.signedIn;

    const followers = await Follow.countDocuments({
      "following._id": data?._id,
    });

    const following = await Follow.countDocuments({
      "follower._id": data?._id,
    });

    data.followers = followers;
    data.following = following;

    return res.status(200).json(GenRes(200, data, null, "Send User"));
  } catch (error) {
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

// verify
const NewOtp = async (req, res) => {
  const email = req?.body?.email?.toLowerCase();
  const response = await setCode(email);
  return res.status(response?.status).json(response);
};

// set password
const SetPassword = async (req, res) => {
  try {
    const { email, password, otp } = req?.body;

    const verifyRes = await verifyCode(email, otp);
    if (verifyRes?.status !== 200) {
      return res.status(verifyRes?.status).json(verifyRes);
    }

    const salt = await bcrypt.genSalt(10);
    const updatedResponse = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          password: await bcrypt.hash(password, salt),
        },
      }
    );
    if (!updatedResponse) {
      throw new Error("Update Failed!");
    }

    // Send FCM notification for password change
    await FCMHandler.sendToUser(updatedResponse._id, {
      title: "Password Updated",
      body: "Your password has been successfully updated",
      type: "password_update",
    });

    return res
      .status(200)
      .json(GenRes(200, null, null, "Updated Successfully "));
  } catch (error) {
    const response = GenRes(500, null, error, error?.message);
    return res.status(500).json(response);
  }
};

// add new data
const SetAvatar = async (req, res) => {
  try {
    const { email } = req?.user;

    if (!req?.file_location) {
      throw new Error("No image uploaded.");
    }

    const uploaded = await User.findOneAndUpdate(
      { email },
      { picture: req?.file_location },
      { new: true }
    );

    if (!uploaded) {
      throw new Error("Failed to upload Picture.");
    }

    // Send FCM notification for avatar update
    await FCMHandler.sendToUser(uploaded._id, {
      title: "Profile Picture Updated",
      body: "Your profile picture has been successfully updated",
      type: "avatar_update",
      image: req?.file_location,
    });

    return res
      .status(200)
      .json(
        GenRes(
          200,
          { picture: req?.file_location },
          null,
          "Uploaded Successfully!"
        )
      );
  } catch (error) {
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

const SetDetails = async (req, res) => {
  try {
    const data = req?.body;
    const email = req?.user?.email;
    if (!email) {
      const response = GenRes(
        400,
        null,
        { error: "Required data not found!" },
        "400 | Bad request"
      );
      return res.status(400).json(response);
    }

    const deletes = "email,_id,uid,password,avatar,refreshToken".split(",");

    for (const keys of deletes) {
      delete data?.[keys];
    }

    const updated = await User.findOneAndUpdate(
      { email },
      { $set: { ...data } }
    );

    if (!updated) {
      throw new Error("500 | Could not save");
    }

    // Send FCM notification for profile update
    await FCMHandler.sendToUser(updated._id, {
      title: "Profile Updated",
      body: "Your profile details have been successfully updated",
      type: "profile_update",
    });

    const response = GenRes(200, data, null, "Updated Successfully!");
    return res.status(200).json(response);
  } catch (error) {
    const response = GenRes(500, null, error, error?.message);
    return res.status(500).json(response);
  }
};

const StalkProfile = async (req, res) => {
  try {
    const _id = req?.params?.id;
    if (!_id || !isValidObjectId(_id)) {
      const response = GenRes(
        400,
        null,
        { error: "user_id must be provided" },
        "User id not provided"
      );
      return res.status(400).json(response);
    }

    const profile = await User.findOne({ _id })
      .select("-uid -password -refreshToken -role -signedIn -createdAt")
      .lean();
    if (!profile) {
      const response = GenRes(
        404,
        null,
        { error: "User not found" },
        "User not found!"
      );
      return res.status(404).json(response);
    }

    const following = await Follow.findOne({
      "follower.email": req?.user?.email,
      "following.email": profile?.email,
    });

    const follower = await Follow.findOne({
      "follower.email": profile.email,
      "following.email": req?.user?.email,
    });

    const followers = await Follow.countDocuments({
      "following.email": profile?.email,
    });
    const followings = await Follow.countDocuments({
      "follower.email": profile?.email,
    });

    profile.followed = !!following;
    profile.friends = !!follower && !!following;
    profile.followers = followers;
    profile.followings = followings;

    // Send FCM notification for profile view
    await FCMHandler.sendToUser(profile._id, {
      title: "Profile Viewed",
      body: "Someone viewed your profile",
      type: "profile_view",
    });

    const response = GenRes(200, profile, null, "Responding User Profile");
    return res.status(200).json(response);
  } catch (error) {
    const response = GenRes(500, null, { error }, error?.message);
    return res.status(500).json(response);
  }
};

const UpdateFCMToken = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user._id;

    if (!token) {
      return res
        .status(400)
        .json(
          GenRes(400, null, { error: "Token is required" }, "Token is required")
        );
    }

    await User.updateOne({ _id: userId }, { $addToSet: { fcmTokens: token } });

    return res
      .status(200)
      .json(GenRes(200, null, null, "FCM token updated successfully"));
  } catch (error) {
    return res.status(500).json(GenRes(500, null, error, error.message));
  }
};

// Submit a report
const SubmitReport = async (req, res) => {
  try {
    const { reportedUserId, reason, description } = req.body;

    if (!reportedUserId || !reason || !description) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Missing required fields" },
            "Please provide all required fields"
          )
        );
    }

    const reportedUser = await User.findById(reportedUserId).select(
      "_id email name"
    );
    if (!reportedUser) {
      return res
        .status(404)
        .json(
          GenRes(
            404,
            null,
            { error: "User not found" },
            "Reported user not found"
          )
        );
    }

    const reporter = await User.findOne({ email: req.user.email }).select(
      "_id email name"
    );

    const report = new Report({
      reporter: reporter.toObject(),
      reportedUser: reportedUser.toObject(),
      reason,
      description,
    });

    await report.save();

    // Notify admins
    const admins = await User.find({ role: "admin" });
    for (const admin of admins) {
      await FCMHandler.sendToUser(admin._id, {
        title: "New User Report",
        body: `New report submitted against ${reportedUser.name}`,
        type: "new_report",
        data: {
          reportId: report._id.toString(),
        },
      });
    }

    return res
      .status(200)
      .json(GenRes(200, report, null, "Report submitted successfully"));
  } catch (error) {
    return res.status(500).json(GenRes(500, null, error, error.message));
  }
};

// Submit support ticket
const SubmitSupport = async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Missing required fields" },
            "Please provide all required fields"
          )
        );
    }

    const user = await User.findOne({ email: req.user.email }).select(
      "_id email name"
    );

    const ticket = new Support({
      user: user.toObject(),
      subject,
      message,
    });

    await ticket.save();

    // Notify admins
    const admins = await User.find({ role: "admin" });
    for (const admin of admins) {
      await FCMHandler.sendToUser(admin._id, {
        title: "New Support Ticket",
        body: `New support ticket: ${subject}`,
        type: "new_support_ticket",
        data: {
          ticketId: ticket._id.toString(),
        },
      });
    }

    return res
      .status(200)
      .json(GenRes(200, ticket, null, "Support ticket submitted successfully"));
  } catch (error) {
    return res.status(500).json(GenRes(500, null, error, error.message));
  }
};

// Get user's reports
const GetUserReports = async (req, res) => {
  try {
    const reports = await Report.find({
      "reporter.email": req.user.email,
    }).sort({ createdAt: -1 });

    return res
      .status(200)
      .json(GenRes(200, reports, null, "Reports retrieved successfully"));
  } catch (error) {
    return res.status(500).json(GenRes(500, null, error, error.message));
  }
};

// Get user's support tickets
const GetUserSupport = async (req, res) => {
  try {
    const tickets = await Support.find({
      "user.email": req.user.email,
    }).sort({ createdAt: -1 });

    return res
      .status(200)
      .json(
        GenRes(200, tickets, null, "Support tickets retrieved successfully")
      );
  } catch (error) {
    return res.status(500).json(GenRes(500, null, error, error.message));
  }
};

//Email verification
const VerifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Email and OTP are required" },
            "Please provide email and OTP"
          )
        );
    }

    // Verify OTP
    const verifyResult = await verifyCode(email.toLowerCase(), otp);
    if (verifyResult.status !== 200) {
      return res.status(verifyResult.status).json(verifyResult);
    }

    // Update user verification status
    const updatedUser = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      {
        $set: {
          emailVerified: true,
          emailVerificationRequired: false,
          emailVerifiedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json(GenRes(404, null, { error: "User not found" }, "User not found"));
    }

    // Send FCM notification for successful verification
    try {
      await FCMHandler.sendToUser(updatedUser._id, {
        title: "Email Verified! 🎉",
        body: "Your email has been successfully verified. You can now login.",
        type: "email_verification",
        data: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (fcmError) {
      console.error("Failed to send FCM notification:", fcmError);
    }

    return res.status(200).json(
      GenRes(
        200,
        {
          message: "Email verified successfully",
          emailVerified: true,
          canLogin: true,
        },
        null,
        "Email verified successfully. You can now login."
      )
    );
  } catch (error) {
    console.error("Error verifying email:", error);
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

// Resend verification OTP
const ResendVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Email is required" },
            "Please provide email address"
          )
        );
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json(GenRes(404, null, { error: "User not found" }, "User not found"));
    }

    // Check if user already verified
    if (user.emailVerified) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Email already verified" },
            "Email is already verified"
          )
        );
    }

    // Check if user is Google user (shouldn't need verification)
    if (!user.emailVerificationRequired) {
      return res
        .status(400)
        .json(
          GenRes(
            400,
            null,
            { error: "Verification not required" },
            "Email verification is not required for this account"
          )
        );
    }

    // Send new OTP
    const otpResult = await setCode(email.toLowerCase());
    if (otpResult.status !== 200) {
      return res.status(otpResult.status).json(otpResult);
    }

    return res.status(200).json(
      GenRes(
        200,
        {
          message: "Verification code sent to your email",
          canResendAfter: 300,
        },
        null,
        "Verification code sent successfully"
      )
    );
  } catch (error) {
    console.error("Error resending verification OTP:", error);
    return res.status(500).json(GenRes(500, null, error, error?.message));
  }
};

module.exports = {
  UserExist,
  GetAllUsers,
  UserProfile,
  NewOtp,
  SetPassword,
  SetAvatar,
  SetDetails,
  StalkProfile,
  UpdateFCMToken,
  SubmitReport,
  SubmitSupport,
  GetUserReports,
  GetUserSupport,
  GetUserContent,
  VerifyEmail,
  ResendVerificationOTP,
};
