const basicMiddleware = require("../../middlewares/basicMiddleware");
const {
  AddComment,
  EditComment,
  DeleteComment,
  GetComments,
} = require("./comments.methods");

const router = require("express").Router();

router.post("/add-comment/:uid", basicMiddleware, AddComment);
router.post("/update-comment/:uid", basicMiddleware, EditComment);
// del
router.delete("/delete-comment/:uid", basicMiddleware, DeleteComment);
// get
router.get("/get-comments/:page", GetComments);

module.exports = router;
