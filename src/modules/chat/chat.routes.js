const router = require("express").Router();
const basicMiddleware = require("../../middlewares/basicMiddleware");
const {
  GetMessages,
  GetChats,
  DeleteMessageForMe,
  DeleteMessageForEveryone,
  DeleteConversation,
} = require("./chat.methods");

// Get chat messages between two users
router.get("/messages/:userId", basicMiddleware, GetMessages);

// Get chat list with latest messages
router.get("/chats", basicMiddleware, GetChats);

// Delete message for me only
router.delete("/message/:messageId", basicMiddleware, DeleteMessageForMe);

// Delete message for everyone
router.delete(
  "/message/:messageId/everyone",
  basicMiddleware,
  DeleteMessageForEveryone
);

// Delete entire conversation
router.delete("/conversation/:userId", basicMiddleware, DeleteConversation);

module.exports = router;
