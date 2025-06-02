import React, { useEffect, useState, useRef } from 'react';
import { io } from "socket.io-client";

const ChatScreen = ({ currentUser, selectedUser, onBack, apiUrl }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [useSocketIO, setUseSocketIO] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef();
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const baseUrl = new URL(apiUrl).origin;
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      socketRef.current = io(baseUrl, {
        path: "/socket.io",
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true,
        auth: {
          userId: currentUser._id || currentUser.id,
          username: currentUser.username || "User"
        }
      });
      socketRef.current.on("connect", () => {
        setSocketStatus('connected');
        reconnectAttempts.current = 0;
        setUseSocketIO(true);
        socketRef.current.emit("user_connected", currentUser._id || currentUser.id);
        const heartbeatInterval = setInterval(() => {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("heartbeat", currentUser._id || currentUser.id);
          }
        }, 30000);
        socketRef.current.on("disconnect", () => clearInterval(heartbeatInterval));
        return () => clearInterval(heartbeatInterval);
      });

      socketRef.current.on("disconnect", (reason) => {
        setSocketStatus('disconnected');
        if (reason === "io server disconnect") {
          socketRef.current.connect();
        }
      });

      socketRef.current.on("connect_error", (error) => {
        setSocketStatus('error');
        if (reconnectAttempts.current++ > 3) {
          setUseSocketIO(false);
          setError(`Chat connection issue: ${error.message}. Using HTTP fallback.`);
        }
      });

      socketRef.current.on("reconnect", () => {
        setSocketStatus('connected');
        setError(null);
      });

      socketRef.current.onAny((event, ...args) => {
        // For debugging
      });

      // --- UPDATED MESSAGE HANDLER ---
      socketRef.current.on("private_message", (message) => {
        const currentUserId = currentUser._id || currentUser.id;
        const selectedUserId = selectedUser?._id || selectedUser?.id;
        if (!selectedUserId) return;

        // Only add messages for this conversation
        if (
          (message.from === selectedUserId && message.to === currentUserId) ||
          (message.from === currentUserId && message.to === selectedUserId) ||
          (message.sender === selectedUserId && message.receiver === currentUserId) ||
          (message.sender === currentUserId && message.receiver === selectedUserId)
        ) {
          const isSender = (message.sender || message.from) === currentUserId;
          const formattedMessage = {
            _id: message._id || `temp-${Date.now()}`,
            sender: message.sender || message.from,
            receiver: message.receiver || message.to,
            text: isSender
              ? (message.originalText || message.text || message.message)
              : (message.translatedText || message.text || message.originalText || message.message),
            seen: message.seen || false,
            timestamp: message.timestamp || message.createdAt || new Date().toISOString(),
            conversationId: message.conversationId,
            type: message.type,
            image: message.image
          };

          setMessages(prevMessages => {
            // Replace pending message if exists
            const idx = prevMessages.findIndex(
              m =>
                m.pending &&
                m.sender === formattedMessage.sender &&
                m.receiver === formattedMessage.receiver &&
                Math.abs(new Date(m.timestamp) - new Date(formattedMessage.timestamp)) < 5000
            );
            if (idx !== -1) {
              const updated = [...prevMessages];
              updated[idx] = { ...formattedMessage, pending: false };
              return updated;
            }
            // Prevent duplicates
            const isDuplicate = prevMessages.some(
              m => m._id === formattedMessage._id
            );
            if (isDuplicate) return prevMessages;
            return [...prevMessages, formattedMessage];
          });
        }
      });

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          if (socketRef.current && !socketRef.current.connected) {
            socketRef.current.connect();
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    } catch (err) {
      setError("Failed to initialize chat connection: " + err.message);
      setSocketStatus('error');
      setUseSocketIO(false);
    }
  }, [currentUser, apiUrl, selectedUser, conversationId]);

  // --- MAP MESSAGES ON FETCH ---
  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    const currentUserId = currentUser._id || currentUser.id;
    const selectedUserId = selectedUser._id || selectedUser.id;
    if (!currentUserId || !selectedUserId) return;
    setLoading(true);
    fetch(`${apiUrl}/api/conversations/findOrCreate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user1: currentUserId, user2: selectedUserId })
    })
      .then(res => res.json())
      .then(conv => {
        if (conv._id) {
          setConversationId(conv._id);
          return fetch(`${apiUrl}/api/messages/between?user1=${currentUserId}&user2=${selectedUserId}`);
        } else {
          throw new Error("Failed to create conversation");
        }
      })
      .then(res => res.json())
      .then(msgs => {
        // Map messages for sender/receiver
        const mapped = (msgs || []).map(msg => {
          const isSender = msg.sender === currentUserId;
          return {
            ...msg,
            text: isSender ? msg.originalText : (msg.translatedText || msg.text),
            seen: msg.seen || false,
            image: msg.image || null,
            type: msg.type
          };
        });
        setMessages(mapped);
        setError(null);
      })
      .catch(err => {
        setError("Failed to load messages. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [selectedUser, currentUser, apiUrl]);

  // Polling for real-time effect (no socket)
  useEffect(() => {
    if (useSocketIO || !conversationId || !selectedUser) return;
    const interval = setInterval(async () => {
      try {
        const currentUserId = currentUser._id || currentUser.id;
        const selectedUserId = selectedUser._id || selectedUser.id;
        const res = await fetch(`${apiUrl}/api/messages/between?user1=${currentUserId}&user2=${selectedUserId}`);
        if (!res.ok) throw new Error("Failed to fetch messages");
        const msgs = await res.json();
        // Map messages for sender/receiver
        const mapped = (msgs || []).map(msg => {
          const isSender = msg.sender === currentUserId;
          return {
            ...msg,
            text: isSender ? msg.originalText : (msg.translatedText || msg.text),
            seen: msg.seen || false,
            image: msg.image || null,
            type: msg.type,
          };
        });
        setMessages(prev => (mapped.length > prev.length ? mapped : prev));
      } catch (err) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [useSocketIO, conversationId, selectedUser, currentUser, apiUrl]);

  useEffect(() => {
    if (currentUser && !currentUser._id && currentUser.id) currentUser._id = currentUser.id;
    if (selectedUser && !selectedUser._id && selectedUser.id) selectedUser._id = selectedUser.id;
  }, [currentUser, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !conversationId) return;
    const senderId = currentUser?._id || currentUser?.id;
    const receiverId = selectedUser?._id || selectedUser?.id;
    if (!senderId || !receiverId) {
      setError("Invalid user information. Please refresh the page.");
      return;
    }
    const newMsg = {
      conversationId,
      sender: senderId,
      receiver: receiverId,
      originalText: input,
      text: input,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, {...newMsg, pending: true}]);
    setInput("");
    try {
      const res = await fetch(`${apiUrl}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
      });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      setMessages(prev =>
        prev.map(msg =>
          msg.pending && msg.createdAt === newMsg.createdAt
            ? {...msg,...data, pending: false}
            : msg
        )
      );
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("private_message", {
          from: senderId,
          to: receiverId,
          message: input,
          conversationId: conversationId
        });
      }
    } catch (error) {
      setError(`Failed to send message: ${error.message}`);
      setMessages(prev =>
        prev.map(msg =>
          msg.pending && msg.createdAt === newMsg.createdAt
            ? { ...msg, pending: false, failed: true }
            : msg
        )
      );
    }
  };

  // Mark messages as seen when chat is open or messages change
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('mark_seen', {
        conversationId,
        userId: currentUser._id || currentUser.id
      });
    }
  }, [conversationId, currentUser, messages]);

  // Listen for messages_seen event to update seen status
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.on('messages_seen', ({ conversationId: seenConvId, userId }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.conversationId === seenConvId && msg.receiver === userId
            ? { ...msg, seen: true }
            : msg
        )
      );
    });
    return () => {
      if (socketRef.current) {
        socketRef.current.off('messages_seen');
      }
    };
  }, [conversationId]);

  // --- CLEAR CHAT HANDLER ---
  const handleClearChat = async () => {
    if (!conversationId) return;
    try {
      await fetch(`${apiUrl}/api/messages/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      setMessages([]);
      setShowClearDialog(false);
    } catch (err) {
      setError("Failed to clear chat.");
      setShowClearDialog(false);
    }
  };

  const renderSocketStatus = () => {
    if (socketStatus === 'connected' || !useSocketIO) return null;
    return (
      <div className={`text-sm rounded-md p-2 mb-4 flex items-center animate-pulse-slow ${
        socketStatus === 'error'
          ? 'bg-red-900 bg-opacity-30 text-red-200'
          : 'bg-yellow-900 bg-opacity-30 text-yellow-200'
      }`}>
        <div className={`w-2 h-2 rounded-full mr-2 ${
          socketStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
        }`}></div>
        <span>
          {socketStatus === 'error'
            ? 'Connection error. Trying to reconnect...'
            : 'Connecting to chat server...'}
        </span>
      </div>
    );
  };

  // --- PHOTO & AUDIO HANDLERS ---
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !conversationId) return;
    const senderId = currentUser?._id || currentUser?.id;
    const receiverId = selectedUser?._id || selectedUser?.id;
    if (!senderId || !receiverId) {
      setError("Invalid user information. Please refresh the page.");
      return;
    }
    const formData = new FormData();
    formData.append("image", file);
    formData.append("conversationId", conversationId);
    formData.append("sender", senderId);
    formData.append("receiver", receiverId);

    try {
      const res = await fetch(`${apiUrl}/api/messages/image`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload image");
      const data = await res.json();
      // Add to messages immediately
      setMessages((prev) => [...prev, { ...data.data, type: "image" }]);
      // Emit real-time event
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("image_message", { ...data.data, type: "image" });
      }
    } catch (err) {
      setError("Failed to upload image.");
    }
  };
  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // TODO: Implement audio upload logic
      alert("Audio selected: " + file.name);
    }
  };

  // --- FILE HANDLER ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // TODO: Implement file upload logic
      alert("File selected: " + file.name);
    }
  };

  if (!selectedUser) return null;

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-cyan-900 via-gray-900 to-gray-800 animate-fade-in shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-cyan-700 to-cyan-500">
        <div className="flex items-center">
          <button
            className="mr-3 md:hidden text-white hover:text-cyan-200 transition"
            onClick={onBack}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <img
            src={`https://ui-avatars.com/api/?name=${selectedUser.username}&background=22d3ee&color=fff`}
            alt={selectedUser.username}
            className="w-10 h-10 rounded-full border-2 border-cyan-400 shadow"
          />
          <div className="flex flex-col ml-3">
            <span className="font-bold text-white text-base sm:text-lg">{selectedUser.username}</span>
            <span className="text-xs text-cyan-100 opacity-75">
              {!useSocketIO ? "HTTP Mode" : (socketStatus === 'connected' ? 'Connected' : 'Connecting...')}
            </span>
          </div>
        </div>
        <div className="flex items-center">
          {/* Clear Chat Icon Button with label */}
          <button
            className="ml-2 flex items-center px-3 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white"
            onClick={() => setShowClearDialog(true)}
            title="Clear Chat"
            aria-label="Clear Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" className="mr-1">
              <path d="M3 6h18M9 6v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V6m-6 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
          <button
            className="md:hidden p-2 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white"
            onClick={onBack}
            aria-label="Show contacts"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 bg-gradient-to-b from-transparent to-gray-900">
        {renderSocketStatus()}
        {error && (
          <div className="bg-red-900 bg-opacity-50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 animate-fade-in">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline text-cyan-300 hover:text-cyan-200"
            >
              Dismiss
            </button>
          </div>
        )}
        {loading ? (
          <div className="text-gray-400 text-center mt-10 animate-pulse-slow">
            <div className="inline-block p-2 bg-cyan-800 bg-opacity-30 rounded-lg">
              Loading messages...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-gray-400 text-center mt-10 animate-fade-in-slow">No previous messages</div>
        ) : (
          messages.map((msg, idx) => {
            const isSender = msg.sender === (currentUser._id || currentUser.id);
            return (
              <div key={idx} className={`flex ${isSender ? "justify-end" : "justify-start"} animate-slide-up`}>
                <div
                  className={`px-4 sm:px-5 py-2 sm:py-3 rounded-2xl max-w-[75%] sm:max-w-xs shadow-md ${
                    isSender
                      ? `bg-gradient-to-br from-cyan-500 to-cyan-700 text-white rounded-br-none
                         ${msg.pending ? 'opacity-50' : ''}
                         ${msg.failed ? 'border-2 border-red-400' : ''}`
                      : "bg-cyan-100 text-cyan-900 rounded-bl-none border border-cyan-300"
                  }`}
                >
                  <div>
                    {msg.type === "image" && msg.image && msg.image.id ? (
                      <div className="relative group">
                        <img
                          src={`${apiUrl}/api/images/${msg.image.id}`}
                          alt="shared"
                          className="max-w-xs rounded-lg mb-1"
                          style={{ maxHeight: 200 }}
                          onError={e => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/150?text=Image+not+found"; }}
                        />
                        <a
                          href={`${apiUrl}/api/images/${msg.image.id}`}
                          download={`chat-image-${msg.image.id}.jpg`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-cyan-700 hover:bg-cyan-800 text-white rounded-full p-1"
                          title="Download image"
                        >
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                            <path d="M12 16v-8M8 12l4 4 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                            <path d="M20 20H4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </a>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                  <div className="text-xs text-indigo-300 mt-1 text-right flex justify-end items-center">
                    {msg.failed && <span className="text-red-300 mr-1">Failed</span>}
                    {msg.pending && <span className="mr-1">Sending...</span>}
                    {(msg.createdAt || msg.timestamp)
                      ? new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : ""}
                    {isSender && !msg.failed && !msg.pending && (
                      <span className="ml-2">
                        {msg.seen
                          ? <span title="Seen" style={{ color: "#22d3ee" }}>✓✓</span>
                          : <span title="Delivered" style={{ color: "#bbb" }}>✓</span>
                        }
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex border-t border-gray-800 bg-gray-950 p-3 sm:p-4"
      >
        {/* Photo upload */}
        <label className="mr-2 cursor-pointer flex items-center" title="Send Photo">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <span className="p-2 rounded-full bg-cyan-700 hover:bg-cyan-800 text-white">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM16 3v4M8 3v4M3 9h18" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
        </label>
        {/* Audio upload */}
        <label className="mr-2 cursor-pointer flex items-center" title="Send Audio">
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleAudioUpload}
          />
          <span className="p-2 rounded-full bg-green-700 hover:bg-green-800 text-white">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path d="M12 3v10M8 7h8M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
        </label>
        {/* File upload */}
        <label className="mr-2 cursor-pointer flex items-center" title="Send File">
          <input
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <span className="p-2 rounded-full bg-yellow-600 hover:bg-yellow-700 text-white">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <path d="M14 2v6h6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
        </label>
        <input
          type="text"
          className="flex-1 px-3 py-2 rounded-full bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition text-sm sm:text-base"
          placeholder={loading ? "Loading chat..." : "Type a message..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || !conversationId}
        />
        <button
          type="submit"
          className={`ml-2 sm:ml-3 px-4 sm:px-6 py-2 rounded-full
            ${loading || !conversationId || !input.trim()
              ? "bg-gray-700 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500 to-cyan-700 hover:scale-105 hover:from-cyan-400 hover:to-cyan-600"
            } text-white font-semibold shadow transition-all duration-200 text-sm sm:text-base`}
          disabled={loading || !conversationId || !input.trim()}
        >
          Send
        </button>
      </form>
      {/* Clear Chat Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-80 max-w-full border border-cyan-700">
            <h2 className="text-lg font-semibold text-white mb-3">Clear Chat</h2>
            <p className="text-gray-200 mb-5">Are you sure you want to clear this chat? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                className="px-4 py-2 rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
                onClick={() => setShowClearDialog(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                onClick={handleClearChat}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Animations */}
      <style>{`
        .animate-fade-in { animation: fadeIn 0.7s; }
        .animate-fade-in-slow { animation: fadeIn 1.2s; }
        .animate-slide-up { animation: slideUp 0.4s; }
        .animate-pulse-slow { animation: pulse 2s infinite; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px);} to { opacity: 1; transform: translateY(0);} }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
};

export default ChatScreen;