const jwt = require("jsonwebtoken");

const tokenGen = (data) => {
  const refKey = process.env.JWT_REFRESH_SECRET;
  const accKey = process.env.JWT_SECRET;

  const refreshToken = jwt.sign(
    { _id: data._id, email: data.email, phone: data.phone },
    refKey,
    { expiresIn: "30d" }
  );

  const accessToken = jwt.sign(
    { _id: data._id, email: data.email, phone: data.phone },
    accKey,
    { expiresIn: "24h" }
  );

  return { refreshToken, accessToken };
};

module.exports = { tokenGen };
