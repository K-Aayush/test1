const router = require("express").Router();
const basicMiddleware = require("../../middlewares/basicMiddleware");
const LikeHandler = require("./likes.methods");

router.post("/handle-like", basicMiddleware, LikeHandler);

module.exports = router;
