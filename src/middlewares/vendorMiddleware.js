const User = require("../modules/user/user.model");
const GenRes = require("../utils/routers/GenRes");
const jwt = require("jsonwebtoken");

const vendorKey = process.env.JWT_SECRET;

const vendorMiddleware = async (req, res, next) => {
  try {
    const author = req?.body?.author;
    req.user = author || null;

    const authorization = req?.headers?.authorization;
    if (!authorization) {
      throw new Error("authorization in headers is missing!");
    }

    const token = authorization?.replace("Bearer ", "");
    if (!token) throw new Error("Token not recieved from client!");

    const decoded = jwt.verify(token, vendorKey);
    if (!decoded) {
      throw new Error("Token Incorrect or Expired!");
    }

    const { email, _id, phone } = decoded;

    const vendor = await User.findOne({
      email,
      _id,
      phone,
      role: "vendor",
    })
      .select("email _id phone name businessName")
      .lean();
      
    if (!vendor) {
      throw new Error("You are not a vendor!");
    }

    req.vendor = vendor;
    return next();
  } catch (error) {
    const response = GenRes(
      401,
      null,
      "Error:UNAUTHORIZED",
      error?.message || "You are not a vendor"
    );
    return res.status(401).json(response);
  }
};

module.exports = { vendorMiddleware };