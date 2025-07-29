const { Schema, model, models } = require("mongoose");
const ModelGenerator = require("../../utils/database/modelGenerator");

const gen = new ModelGenerator();

const contentSchema = new Schema(
  {
    status: String,
    files: [String],
    type: gen.required(String, {
      default: "innovation",
      enum: [
        "innovation",
        "idea",
        "project",
        "question",
        "announcement",
        "share",
        "other",
      ],
      set: (v) => v.toLowerCase(),
    }),
    author: {
      name: gen.required(String),
      picture: String,
      email: gen.required(String),
      _id: String,
    },
    views: { type: Number, default: 0 },
    viewedBy: [{ type: String }],
    isShared: { type: Boolean, default: false },
    originalContent: {
      _id: String,
      type: String,
      files: [String],
      status: String,
      author: {
        name: String,
        picture: String,
        email: String,
        _id: String,
      },
      createdAt: Date,
    },
    shareText: String,
  },
  { timestamps: true, timeseries: true }
);

contentSchema.pre("save", function (next) {
  if (!this.author?._id) {
    return next(new Error("Author details must include user_id or uid!"));
  }
  next();
});

const Content = models?.Content || model("Content", contentSchema);
module.exports = Content;
