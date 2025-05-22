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
  const [useSocketIO, setUseSocketIO] = useState(true); // Track if we should use Socket.IO or fallback
  const messagesEndRef = useRef(null);
  const socketRef = useRef();
  const reconnectAttempts = useRef(0);

  // Check for mobile screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Enhanced socket connection with better error handling
  useEffect(() => {
    if (!currentUser) return;
    
    // FIX: Parse the API URL to get the base URL (removing /api if it exists)
    const baseUrl = new URL(apiUrl).origin;
    console.log("Base Socket.IO URL:", baseUrl);
    
    try {
      // Clear any existing socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Create socket with correct configuration - MAIN FIX HERE
      socketRef.current = io(baseUrl, {
        path: "/socket.io", // IMPORTANT: Use default Socket.IO path
        transports: ["polling", "websocket"], // Start with polling, try websocket after
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true,
        auth: {
          userId: currentUser._id || currentUser.id,
          username: currentUser.username || "Dishang18"
        }
      });
      
      // Connection handlers
      socketRef.current.on("connect", () => {
        console.log("Socket connected with ID:", socketRef.current.id);
        setSocketStatus('connected');
        reconnectAttempts.current = 0;
        setUseSocketIO(true);
        
        // Register user with the socket server
        socketRef.current.emit("user_connected", currentUser._id || currentUser.id);
        
        // Start heartbeat to maintain connection
        const heartbeatInterval = setInterval(() => {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("heartbeat", currentUser._id || currentUser.id);
          }
        }, 30000); // Every 30 seconds
        
        // Clear interval on disconnect
        socketRef.current.on("disconnect", () => {
          clearInterval(heartbeatInterval);
        });
        
        return () => clearInterval(heartbeatInterval);
      });
      
      socketRef.current.on("disconnect", (reason) => {
        console.log(`Socket disconnected: ${reason}`);
        setSocketStatus('disconnected');
        
        // Automatically reconnect if server disconnected us
        if (reason === "io server disconnect") {
          socketRef.current.connect();
        }
      });
      
      socketRef.current.on("connect_error", (error) => {
        console.log("Connection error:", error);
        setSocketStatus('error');
        
        // After multiple failures, fall back to HTTP
        if (reconnectAttempts.current++ > 3) {
          console.log("Socket.IO failed multiple times, falling back to HTTP");
          setUseSocketIO(false);
          setError(`Chat connection issue: ${error.message}. Using HTTP fallback.`);
        }
      });
      
      socketRef.current.on("reconnect", (attemptNumber) => {
        console.log(`Socket reconnected after ${attemptNumber} attempts`);
        setSocketStatus('connected');
        setError(null);
      });
      
      // Log all socket events for debugging
      socketRef.current.onAny((event, ...args) => {
        console.log(`Socket event: ${event}`, args);
      });

      // Message handling
      socketRef.current.on("private_message", (message) => {
        console.log("Received message via socket:", message);
        
        const currentUserId = currentUser._id || currentUser.id;
        const selectedUserId = selectedUser?._id || selectedUser?.id;
        
        // Skip if no selected user
        if (!selectedUserId) return;
        
        if ((message.from === selectedUserId && message.to === currentUserId) || 
            (message.from === currentUserId && message.to === selectedUserId) ||
            (message.sender === selectedUserId && message.receiver === currentUserId) ||
            (message.sender === currentUserId && message.receiver === selectedUserId)) {
          
          const formattedMessage = {
            _id: message._id || `temp-${Date.now()}`,
            sender: message.sender || message.from,
            receiver: message.receiver || message.to,
            originalText: message.originalText || message.text || message.message,
            timestamp: message.timestamp || message.createdAt || new Date().toISOString(),
            conversationId: conversationId
          };
          
          setMessages(prevMessages => {
            const isDuplicate = prevMessages.some(m => 
              m.originalText === formattedMessage.originalText && 
              Math.abs(new Date(m.timestamp) - new Date(formattedMessage.timestamp)) < 5000
            );
            
            if (isDuplicate) {
              return prevMessages;
            }
            return [...prevMessages, formattedMessage];
          });
        }
      });

      // Handle page visibility changes
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          // Reconnect if needed when user returns to tab
          if (socketRef.current && !socketRef.current.connected) {
            console.log("Page visible again, reconnecting socket");
            socketRef.current.connect();
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Clean up
      return () => {
        console.log("Cleaning up socket connection");
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    } catch (err) {
      console.error("Error setting up socket:", err);
      setError("Failed to initialize chat connection: " + err.message);
      setSocketStatus('error');
      setUseSocketIO(false);
    }
  }, [currentUser, apiUrl]);

  // HTTP fallback polling when Socket.IO fails
  useEffect(() => {
    // Skip if socket is working or no conversation
    if (useSocketIO || !conversationId || !selectedUser) return;
    
    console.log("Using HTTP polling fallback for messages");
    
    // Poll for new messages every 3 seconds
    const interval = setInterval(async () => {
      try {
        const currentUserId = currentUser._id || currentUser.id;
        const selectedUserId = selectedUser._id || selectedUser.id;
        
        const res = await fetch(`${apiUrl}/messages/between?user1=${currentUserId}&user2=${selectedUserId}`);
        if (!res.ok) throw new Error("Failed to fetch messages");
        
        const msgs = await res.json();
        
        setMessages(prev => {
          // Only update if we have new messages
          if (msgs.length > prev.length) {
            return msgs;
          }
          return prev;
        });
      } catch (err) {
        console.error("Error polling for messages:", err);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [useSocketIO, conversationId, selectedUser, currentUser, apiUrl]);

  // Fix user objects if needed
  useEffect(() => {
    if (currentUser && !currentUser._id && currentUser.id) {
      console.log("Fixing currentUser structure...");
      currentUser._id = currentUser.id;
    }
    
    if (selectedUser && !selectedUser._id && selectedUser.id) {
      console.log("Fixing selectedUser structure...");
      selectedUser._id = selectedUser.id;
    }
  }, [currentUser, selectedUser]);
  
  // Fetch previous messages when selectedUser changes
  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    
    const currentUserId = currentUser._id || currentUser.id;
    const selectedUserId = selectedUser._id || selectedUser.id;
    
    if (!currentUserId || !selectedUserId) return;
    
    setLoading(true);
    
    // Create or find conversation
    fetch(`${apiUrl}/conversations/findOrCreate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user1: currentUserId, user2: selectedUserId })
    })
      .then(res => res.json())
      .then(conv => {
        if (conv._id) {
          setConversationId(conv._id);
          return fetch(`${apiUrl}/messages/between?user1=${currentUserId}&user2=${selectedUserId}`);
        } else {
          throw new Error("Failed to create conversation");
        }
      })
      .then(res => res.json())
      .then(msgs => {
        setMessages(msgs || []);
        setError(null);
      })
      .catch(err => {
        console.error("Error fetching messages:", err);
        setError("Failed to load messages. Please try again.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedUser, currentUser, apiUrl]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a message
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
    
    // Add to UI immediately
    setMessages(prev => [...prev, {...newMsg, pending: true}]);
    setInput("");
    
    try {
      // Send to server
      const res = await fetch(`${apiUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
      });
      
      if (!res.ok) throw new Error("Failed to send message");
      
      const data = await res.json();
      
      // Update local message
      setMessages(prev => 
        prev.map(msg => 
          msg.pending && msg.createdAt === newMsg.createdAt 
            ? {...data, pending: false} 
            : msg
        )
      );
      
      // Emit socket event if socket is connected
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("private_message", {
          from: senderId,
          to: receiverId,
          message: input,
          conversationId: conversationId
        });
      }
    } catch (error) {
      console.error("Send error:", error);
      setError(`Failed to send message: ${error.message}`);
      
      // Mark as failed
      setMessages(prev => 
        prev.map(msg => 
          msg.pending && msg.createdAt === newMsg.createdAt 
            ? {...msg, pending: false, failed: true} 
            : msg
        )
      );
    }
  };

  // Socket status indicator component
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

  if (!selectedUser) return null;

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-cyan-900 via-gray-900 to-gray-800 animate-fade-in rounded-xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 bg-gradient-to-r from-cyan-700 to-cyan-500 rounded-t-xl">
        {/* Left side with back button and user info */}
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

        {/* Mobile button to show contacts */}
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
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 bg-gradient-to-b from-transparent to-gray-900">
        {/* Socket status indicator */}
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
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.sender === (currentUser._id || currentUser.id) ? "justify-end" : "justify-start"
              } animate-slide-up`}
            >
              <div
                className={`px-4 sm:px-5 py-2 sm:py-3 rounded-2xl max-w-[75%] sm:max-w-xs shadow-md ${
                  msg.sender === (currentUser._id || currentUser.id)
                    ? `bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white rounded-br-none
                       ${msg.pending ? 'opacity-50' : ''}
                       ${msg.failed ? 'border-2 border-red-400' : ''}`
                    : "bg-indigo-900 text-indigo-100 rounded-bl-none border border-blue-700"
                }`}
              >
                {msg.text || msg.originalText}
                <div className="text-xs text-indigo-300 mt-1 text-right flex justify-end items-center">
                  {msg.failed && <span className="text-red-300 mr-1">Failed</span>}
                  {msg.pending && <span className="mr-1">Sending...</span>}
                  {(msg.createdAt || msg.timestamp)
                    ? new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : ""}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex border-t border-gray-800 bg-gray-950 p-3 sm:p-4 rounded-b-xl"
      >
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
      
      {/* Mobile toggle button for contacts (floating) */}
      {isMobile && (
        <button
          onClick={onBack}
          className="md:hidden fixed bottom-5 left-5 z-50 w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-700 text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          aria-label="Show Contacts"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </button>
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