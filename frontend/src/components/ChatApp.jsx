import React, { useState } from "react";
import ConversationList from "./ConversationList";
import ChatScreen from "./ChatScreen";

// currentUser example: { _id: "userId", username: "yourname" }
const ChatApp = ({ currentUser }) => {
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-1/3 border-r">
        <ConversationList
          currentUser={currentUser}
          onSelectUser={setSelectedUser}
        />
      </div>
      <div className="flex-1">
        {selectedUser ? (
          <ChatScreen
            currentUser={currentUser}
            selectedUser={selectedUser}
            onBack={() => setSelectedUser(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp;