import React, { useEffect, useState } from "react";
import { getConversations } from "../api";

// This component lists all conversations for the current user
const ConversationList = ({ currentUser, onSelectUser }) => {
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (currentUser?._id)
      getConversations(currentUser._id).then(setConversations).catch(() => setConversations([]));
  }, [currentUser]);

  return (
    <div className="conversation-list">
      <h3 className="text-lg font-bold px-4 py-2">Chats</h3>
      <div>
        {conversations.length === 0 && (
          <div className="p-4 text-gray-400">No chats yet.</div>
        )}
        {conversations.map((conv) => {
          // Find the other user (not currentUser)
          const other = conv.participants.find(
            (user) => user._id !== currentUser._id
          );
          return (
            <div
              key={conv._id}
              className="flex items-center p-4 border-b hover:bg-gray-100 cursor-pointer"
              onClick={() => onSelectUser(other)}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${other.username}&background=22d3ee&color=fff`}
                alt={other.username}
                className="w-8 h-8 rounded-full mr-3"
              />
              <div>
                <div className="font-semibold">{other.username}</div>
                <div className="text-sm text-gray-500 truncate max-w-xs">
                  {conv.lastMessage
                    ? conv.lastMessage.originalText || conv.lastMessage.text
                    : "No messages yet"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationList;