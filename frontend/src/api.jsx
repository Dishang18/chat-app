const API_URL = "http://localhost:9000/api";

// Find or create a conversation between two users
// Enhanced findOrCreateConversation function with better logging
export async function findOrCreateConversation(user1, user2) {
  console.log("Making API call to create conversation:", { user1, user2 });
  
  // Validate inputs first
  if (!user1 || !user2) {
    console.error("Missing required user IDs:", { user1, user2 });
    throw new Error("Both user IDs are required to create a conversation");
  }
  
  try {
    const res = await fetch(`${API_URL}/conversations/findOrCreate`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        // Add auth header if you're using token-based auth
        // "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ user1, user2 }),
      credentials: 'include' // In case you need cookies
    });
    
    // Log the full response for debugging
    console.log("API response status:", res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("API error:", res.status, errorText);
      throw new Error(`Failed: ${res.status} ${errorText}`);
    }
    
    const data = await res.json();
    console.log("Conversation created successfully:", data);
    
    if (!data || !data._id) {
      console.error("Invalid conversation data returned:", data);
      throw new Error("Server returned invalid conversation data");
    }
    
    return data;
  } catch (error) {
    console.error("Error in findOrCreateConversation:", error);
    throw error;
  }
}

// Get all conversations for a user
export async function getConversations(userId) {
  const res = await fetch(`${API_URL}/conversations/${userId}`);
  if (!res.ok) throw new Error("Failed to get conversations");
  return res.json();
}

// Get all messages between two users
export async function getMessages(user1, user2) {
  // This must match your getMessagesBetweenUsers endpoint
  const res = await fetch(`${API_URL}/messages/between?user1=${user1}&user2=${user2}`);
  if (!res.ok) throw new Error("Failed to get messages");
  return res.json();
}

// Send a message (requires conversationId)
// Updated sendMessage function with better error handling and debugging
export async function sendMessage(messageData) {
  console.log("Sending message data:", messageData);
  
  // Validate essential fields
  if (!messageData.conversationId) {
    console.error("Missing conversationId in message data");
    throw new Error("conversationId is required");
  }
  
  if (!messageData.sender || !messageData.receiver) {
    console.error("Missing sender or receiver in message data");
    throw new Error("sender and receiver are required");
  }
  
  try {
    const response = await fetch(`${API_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
      // Remove 'credentials: include' if your server isn't configured for it
    });
    
    // Handle non-200 responses
    if (!response.ok) {
      // Try to get error details from response
      const errorData = await response.json().catch(() => ({}));
      console.error("Server error response:", response.status, errorData);
      throw new Error(errorData.error || `Server returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Message sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error in sendMessage:", error);
    throw new Error(`Failed to send message: ${error.message}`);
  }
}