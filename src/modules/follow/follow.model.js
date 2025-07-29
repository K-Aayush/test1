const { Schema, model, models } = require("mongoose");
const modelGenerator = require("../../utils/database/modelGenerator");

const gen = new modelGenerator();

const FollowSchema = new Schema(
  {
    follower: gen.required({
      name: gen.required(String),
      email: gen.required(String),
      _id: gen.required(String),
      picture: String,
    }),
    following: gen.required({
      name: gen.required(String),
      email: gen.required(String),
      _id: gen.required(String),
      picture: String,
    }),
  },
  { timeseries: true, timestamps: true }
);

const Follow = models?.Follow || model("Follow", FollowSchema);

module.exports = Follow;
