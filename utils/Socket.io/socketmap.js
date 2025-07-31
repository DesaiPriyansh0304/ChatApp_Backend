const userSocketMap = {}; // userId => socket.id
const openedChats = {}; // userId => currentChatId (private - receiverId, group - groupId)

module.exports = {
  userSocketMap,
  openedChats,
};
