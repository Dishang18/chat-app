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

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

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
            image: message.image,
            audio: message.audio
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

      // Audio message real-time
      socketRef.current.on("audio_message", (message) => {
        setMessages(prev => [...prev, { ...message, type: "audio" }]);
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
            audio: msg.audio || null,
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
            audio: msg.audio || null,
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

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !conversationId) return;
    const senderId = currentUser?._id || currentUser?.id;
    const receiverId = selectedUser?._id || selectedUser?.id;
    if (!senderId || !receiverId) {
      setError("Invalid user information. Please refresh the page.");
      return;
    }
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("conversationId", conversationId);
    formData.append("sender", senderId);
    formData.append("receiver", receiverId);

    try {
      const res = await fetch(`${apiUrl}/api/messages/audio`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload audio");
      const data = await res.json();
      setMessages((prev) => [...prev, { ...data, type: "audio" }]);
      // Optionally emit socket event here
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("audio_message", { ...data, type: "audio" });
      }
    } catch (err) {
      setError("Failed to upload audio.");
    }
  };

  // --- AUDIO RECORDING HANDLERS ---
  const startRecording = async () => {
    if (!navigator.mediaDevices) {
      setError("Audio recording not supported in this browser.");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new window.MediaRecorder(stream);
    setMediaRecorder(recorder);
    setAudioChunks([]);
    recorder.start();
    setRecording(true);

    recorder.ondataavailable = (e) => {
      setAudioChunks((prev) => [...prev, e.data]);
    };
    recorder.onstop = async () => {
      setRecording(false);
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const file = new File([audioBlob], "recording.webm", { type: "audio/webm" });
      // Reuse your handleAudioUpload logic:
      const fakeEvent = { target: { files: [file] } };
      await handleAudioUpload(fakeEvent);
    };
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
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
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-gray-900 to-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
          >
            ←
          </button>
          <div className="flex items-center space-x-3">
            <img
              src={`https://ui-avatars.com/api/?name=${selectedUser.username}&background=random`}
              alt={selectedUser.username}
              className="w-10 h-10 rounded-full border-2 border-gray-600"/>
            <div>
              <h2 className="font-semibold text-white">{selectedUser.username}</h2>
              <span className="text-xs text-gray-400">
                {socketStatus === 'connected' ? 'Online' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setShowClearDialog(true)}
          className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Clear Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          const isSender = msg.sender === (currentUser._id || currentUser.id);
          return (
            <div
              key={idx}
              className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] md:max-w-[60%] rounded-lg p-3 ${
                  isSender
                    ? 'bg-blue-600 text-white ml-auto'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                {msg.type === "image" && msg.image && msg.image.id ? (
                  <div className="relative group">
                    <img
                      src={`${apiUrl}/api/images/${msg.image.id}`}
                      alt="shared"
                      className="rounded-lg w-full max-h-[300px] object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://via.placeholder.com/300x200?text=Failed+to+load";
                      }}
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={`${apiUrl}/api/images/${msg.image.id}`}
                        download
                        className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70"
                      >
                        ↓
                      </a>
                    </div>
                  </div>
                ) : msg.type === "audio" && msg.audio && msg.audio.id ? (
                  <audio controls className="w-full max-w-[300px]">
                    <source src={`${apiUrl}/api/audios/${msg.audio.id}`} type="audio/mpeg" />
                  </audio>
                ) : (
                  <p className="break-words">{msg.text}</p>
                )}
                <div className="text-xs mt-1 opacity-75 flex justify-end items-center space-x-1">
                  <span>
                    {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {isSender && (
                    <span>{msg.seen ? '✓✓' : '✓'}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 p-3 bg-gray-900">
        <div className="flex items-center space-x-2">
          <label className="p-2 hover:bg-gray-700 rounded-full cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            📷
          </label>
          <label className="p-2 hover:bg-gray-700 rounded-full cursor-pointer">
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleAudioUpload}
            />
            🎵
          </label>
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`p-2 rounded-full ${
              recording ? 'bg-red-600' : 'hover:bg-gray-700'
            }`}
          >
            🎤
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                handleSend(e);
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>

      {/* Clear Chat Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Clear Chat</h3>
            <p className="text-gray-300 mb-6">Are you sure you want to clear all messages? This cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowClearDialog(false)}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatScreen;