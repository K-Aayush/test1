const { Schema, model, models } = require("mongoose");
const ModelGenerator = require("../../utils/database/modelGenerator");

const gen = new ModelGenerator();

const CartSchema = new Schema({
  email: gen.required(String),
  product: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
  quantity: gen.required(Number, { default: 1 }),
  price: gen.required(Number, { default: 0 }),
});

const Cart = models.Cart || model("Cart", CartSchema);
module.exports = Cart; // export the model
