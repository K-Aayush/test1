const mongoose = require("mongoose");

const connectDB = () => {
  try {
    const uri = process.env.DB_URL;
    mongoose.connect(uri);
    mongoose.connection.on("error", (error) => {
      console.error.bind("Error in connecting DB", error);
    });
    mongoose.connection.once("open", () => {
      console.log("Connected DB in ", uri);
    });
  } catch (error) {
    console.error("Error occured in Data Base : ", error);
  }
};

module.exports = connectDB;
