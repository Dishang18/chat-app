import React, { useEffect, useState, useRef } from 'react';

const ChatScreen = ({ currentUser, selectedUser, onBack, apiUrl }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Fetch previous messages when selectedUser changes
  useEffect(() => {
    if (!selectedUser) return;
    fetch(`${apiUrl}/messages?user1=${currentUser._id || currentUser.id}&user2=${selectedUser._id || selectedUser.id}`)
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(() => setMessages([]));
  }, [selectedUser, currentUser, apiUrl]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const newMsg = {
      sender: currentUser._id || currentUser.id,
      receiver: selectedUser._id || selectedUser.id,
      text: input,
    };
    setMessages([...messages, { ...newMsg, createdAt: new Date() }]);
    setInput('');
    await fetch(`${apiUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg),
    });
  };

  if (!selectedUser) return null;

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-cyan-900 via-gray-900 to-gray-800 animate-fade-in rounded-xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-cyan-700 to-cyan-500 rounded-t-xl">
        <button className="mr-3 md:hidden text-white hover:text-cyan-200 transition" onClick={onBack}>
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
            <path d="M15 19l-7-7 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <img
          src={`https://ui-avatars.com/api/?name=${selectedUser.username}&background=22d3ee&color=fff`}
          alt={selectedUser.username}
          className="w-10 h-10 rounded-full border-2 border-cyan-400 shadow"
        />
        <span className="font-bold text-white text-lg ml-4">{selectedUser.username}</span>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 bg-gradient-to-b from-transparent to-gray-900">
        {messages.length === 0 ? (
          <div className="text-gray-400 text-center mt-10 animate-fade-in-slow">No previous messages</div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.sender === (currentUser._id || currentUser.id) ? 'justify-end' : 'justify-start'} animate-slide-up`}
            >
              <div className={`
                px-5 py-3 rounded-2xl max-w-xs shadow-md
                ${msg.sender === (currentUser._id || currentUser.id)
                  ? 'bg-gradient-to-br from-purple-500 via-blue-500 to-teal-400 text-white rounded-br-none'
                  : 'bg-indigo-900 text-indigo-100 rounded-bl-none border border-blue-700'}
              `}>
                {msg.text}
                <div className="text-xs text-indigo-300 mt-1 text-right">
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      <form onSubmit={handleSend} className="flex border-t border-gray-800 bg-gray-950 p-4 rounded-b-xl">
        <input
          type="text"
          className="flex-1 px-4 py-2 rounded-full bg-gray-800 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="ml-3 px-6 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-700 text-white font-semibold shadow hover:scale-105 hover:from-cyan-400 hover:to-cyan-600 transition-all duration-200"
        >
          Send
        </button>
      </form>
      {/* Animations */}
      <style>{`
        .animate-fade-in { animation: fadeIn 0.7s; }
        .animate-fade-in-slow { animation: fadeIn 1.2s; }
        .animate-slide-up { animation: slideUp 0.4s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px);} to { opacity: 1; transform: translateY(0);} }
      `}</style>
    </div>
  );
};

export default ChatScreen;