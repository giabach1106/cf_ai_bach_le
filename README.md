# ⚡ EdgeMind: Cloudflare AI Research Agent

EdgeMind is a serverless, real-time AI chat application built on the **Cloudflare Developer Platform**. It demonstrates the power of Edge Computing by combining **Durable Objects** for stateful consistency, **Workers AI (Llama 3.3)** for low-latency intelligence, and **Vectorize** for RAG-powered contextual memory.

## 🚀 Key Features

* **🧠 Edge Intelligence:** Powered by **Llama 3.3 (FP8)** running directly on Cloudflare Workers AI.
* **🔍 RAG Memory System:** Uses **Cloudflare Vectorize** and embeddings (@cf/baai/bge-base-en-v1.5) to give the AI long-term contextual memory.
* **⚡ Real-time Streaming:** Zero-latency token streaming directly to WebSocket clients.
* **💾 Stateful Architecture:** Uses **Durable Objects** to maintain chat history and state consistency across global edge locations.
* **🎨 Modern UI:** A responsive, glassmorphism-inspired interface with Markdown rendering and auto-scroll.
* **🗑️ Clear Chat:** Ability to clear chat history for all users with one click (also clears vector embeddings).
* **🔄 Auto-reconnect:** Automatic reconnection handling with up to 5 retry attempts.

## 🛠️ Tech Stack

* **Runtime:** Cloudflare Workers
* **Framework:** Hono (TypeScript)
* **State:** Cloudflare Durable Objects
* **AI Inference:** Workers AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast)
* **Embeddings:** Workers AI (@cf/baai/bge-base-en-v1.5)
* **Vector Database:** Cloudflare Vectorize
* **Frontend:** HTML5, CSS3, Vanilla JS (served via Workers Assets)

## 🏃‍♂️ How to Run

1.  **Clone the repository**
    ```bash
    git clone https://github.com/giabach1106/cf_ai_bach_le.git
    cd cd_ai_bach_le
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Create Vectorize Index** (Required for RAG)
    ```bash
    npx wrangler vectorize create chat-index --dimensions=768 --metric=cosine
    ```

4.  **Start Development Server**
    ```bash
    npm run dev
    ```
    Visit `http://localhost:8787` to start chatting.
    
    **Note:** For RAG features to work, you need to run in remote mode since Vectorize requires remote resources:
    ```bash
    npm run dev  # Will use remote bindings automatically
    ```

## 📖 How to Use

### Chat with Other Users
1. Enter your username in the left input field
2. Type your message in the main input field
3. Press **Enter** or click **Send**
4. Your messages will be broadcast to all connected users

### Ask the AI Assistant (with RAG Memory)
1. Start your message with `@ai` followed by your question
2. Example: `@ai What is Cloudflare Workers?`
3. The AI will respond with streaming text in real-time
4. **RAG Features:**
   - The AI automatically remembers previous conversations
   - Messages are converted to embeddings and stored in Vectorize
   - When you ask a question, the system retrieves the 5 most similar past messages
   - The AI uses this context to provide more relevant and personalized answers
5. AI responses support **Markdown formatting** including:
   - Code blocks with syntax highlighting
   - Bold, italic, lists
   - Links and more

**Example RAG Workflow:**
```
User: @ai My name is Bach, I like coffee
AI: Nice to meet you, Bach! Coffee is great.

[Later in conversation]

User: @ai What do I like to drink?
AI: You like coffee! [AI remembers from context]
```

### Clear Chat History
1. Click the **🗑️ Clear Chat** button in the header
2. Confirm the action
3. All messages will be deleted for all users
4. All vector embeddings will be **completely removed** from Vectorize (including old untracked vectors)
5. A system notification will announce the action

**How Complete Cleanup Works:**
- Queries Vectorize with a zero vector to find ALL existing vectors
- Deletes all discovered vector IDs
- Verifies deletion with a follow-up query
- Logs remaining vectors if any are found
- This ensures no "ghost" vectors remain from previous sessions

### Change Your Username
1. Simply type a new name in the left username input field
2. Your next message will automatically use the new name
3. No reconnection required - changes apply immediately
4. Username is saved in localStorage for future sessions

## 🔧 Recent Updates

### 🎯 Production-Ready Fixes (Latest)
- ✅ **Complete Vector Cleanup:** Query-all-then-delete approach ensures ALL vectors are removed
- ✅ **Real-time Username Updates:** Username changes apply immediately without reconnection
- ✅ **Session Isolation:** Per-user isolated chat rooms with unique room IDs
- ✅ **Verification System:** Post-deletion verification to confirm complete cleanup
- ✅ **Improved Logging:** Enhanced debug output for troubleshooting

### ✨ RAG Implementation
- ✅ Integrated Cloudflare Vectorize for semantic search
- ✅ Automatic embedding generation for all user messages
- ✅ Context retrieval using cosine similarity
- ✅ Enhanced AI responses with relevant conversation history
- ✅ Non-blocking embedding storage for better performance
- ✅ Vector cleanup when clearing chat history

### Fixed AI Streaming Issues
- ✅ Fixed incomplete AI responses (was only showing partial text)
- ✅ Properly parse Workers AI streaming format using async iteration
- ✅ Removed incorrect SSE parsing that caused truncated responses

### Added Clear Chat Feature
- ✅ Added clear history command handler in Durable Object
- ✅ Added clear button in UI header
- ✅ Broadcasts clear notification to all connected users
- ✅ Includes confirmation dialog to prevent accidental deletion

## 📊 Architecture

### Session Isolation Model

**Current Implementation: Per-User Isolated Chat Rooms**

Each browser session gets a unique room ID, creating isolated chat experiences:

```
User A (Browser 1)
  ↓
  Generates: room-abc123
  ↓
  Durable Object Instance #1
  ↓
  Isolated message history & vectors

User B (Browser 2)
  ↓
  Generates: room-xyz789
  ↓
  Durable Object Instance #2
  ↓
  Separate isolated history & vectors
```

**How It Works:**
1. On first visit, client generates a unique `roomId` using `crypto.randomUUID()`
2. `roomId` is stored in `localStorage` for persistence across page refreshes
3. WebSocket connects to `/api/chat?room={roomId}`
4. Server creates Durable Object with `idFromName('room-{roomId}')`
5. Each unique room ID = separate DO instance = isolated chat environment

**Switching to Shared Global Chat:**

To enable a shared chat room for all users, modify `public/index.html`:

```javascript
// Comment out these lines (around line 480):
// if (!roomId) {
//     roomId = crypto.randomUUID();
//     localStorage.setItem('chat_room_id', roomId);
// }

// And set:
roomId = 'default'; // All users share the same room
```

**Advantages of Current Model:**
- ✅ Each user has private AI assistant with isolated RAG context
- ✅ No cross-user data leakage
- ✅ Scalable: DOs distributed across edge network
- ✅ Perfect for personal AI assistant use case

**When to Use Shared Model:**
- Public chat rooms
- Community discussions
- Collaborative AI interactions

### RAG Pipeline
```
User Message
    ↓
Generate Embedding (BGE-base-en-v1.5)
    ↓
Store in Vectorize (background, non-blocking)
    ↓
User asks @ai question
    ↓
Generate Query Embedding
    ↓
Query Vectorize (top 5 similar messages, cosine similarity)
    ↓
Inject context into LLM prompt
    ↓
Llama 3.3 generates contextual response
    ↓
Stream response to user
```

### Configuration
- **Embedding Model:** `@cf/baai/bge-base-en-v1.5` (768 dimensions)
- **Vector Index:** `chat-index` (cosine metric)
- **Context Retrieval:** Top 5 matches with similarity score > 0.5
- **LLM Model:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

## 🐛 Debugging

### Enable RAG Debug Messages
To see detailed RAG operation logs in the chat UI:

1. Open `src/ChatRoom.ts`
2. Find line ~339 (look for `ENABLE_RAG_DEBUG`)
3. Ensure it's set to `true` (default: enabled)
4. Restart the dev server

You'll see messages like:
- 🔍 Generating embedding...
- 🔎 Querying Vectorize...
- 📝 Match results with similarity scores
- ✅ Context usage confirmation

### Verify Complete Vector Cleanup

After clicking "Clear Chat", check the browser console for:

```
[RAG] Querying Vectorize to find all vectors...
[RAG] Found X vectors in Vectorize
[RAG] Deleting X vectors from Vectorize...
[RAG] ✓ Successfully deleted X vectors
[RAG] ✓ Verified: All vectors successfully deleted
```

If vectors remain, you'll see:
```
[RAG] ⚠️ Warning: N vectors still remain after deletion
```

### Check Your Room ID

To see your current isolated room ID, open browser console:
```javascript
localStorage.getItem('chat_room_id')
// Returns: "abc123..." (your unique room ID)
```

## 🚀 Deployment to Production

1. **Deploy to Cloudflare Workers:**
   ```bash
   npm run deploy
   ```

2. **Verify Vectorize Index Exists:**
   ```bash
   npx wrangler vectorize list
   # Should show: chat-index (768 dimensions, cosine)
   ```

3. **Test Production Deployment:**
   - Each user automatically gets isolated room
   - Test clearing chat to verify complete vector cleanup
   - Change username mid-session to verify real-time updates

## ⚠️ Important Notes

### Vector Cleanup Limitations
- Vectorize query has a max `topK` limit (~10,000 vectors)
- If your room has >10,000 messages, some old vectors may remain
- For production with high message volume, consider implementing pagination or periodic cleanup jobs

### Username Updates
- Username changes apply immediately for new messages
- Old messages retain their original username (by design)
- No retroactive username changes in history

### Session Persistence
- Room IDs are stored in `localStorage`
- Clearing browser data = new isolated room created
- To "reset" your chat: Clear `localStorage` or use incognito mode

## 🤖 AI Assistance
See [PROMPTS.md](./PROMPTS.md) for the detailed engineering logs and prompts used to architect this solution.