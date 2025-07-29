const { Schema, model, models } = require("mongoose");
const ModelGenerator = require("../../utils/database/modelGenerator");

const gen = new ModelGenerator();

const CategorySchema = new Schema(
  {
    name: gen.required(String),
    description: String,
    vendor: {
      _id: gen.required(String),
      email: gen.required(String),
      businessName: gen.required(String),
    },
  },
  { timestamps: true }
);

const Category = models?.Category || model("Category", CategorySchema);
module.exports = Category;
