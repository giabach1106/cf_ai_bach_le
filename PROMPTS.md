"This project was built using an iterative AI-assisted workflow. Below are the specific prompts used to architect the Durable Object state machine and the AI streaming logic." - Bach Le
---

I am building a Cloudflare AI application using Hono, Workers AI (Llama 3.3), and Durable Objects.

Phase 1: Configuration.
Please analyze my project structure and strictly update `wrangler.toml` with the following configuration:

1.  Define a binding named `CHAT_ROOM` pointing to a class named `ChatRoom`. Also define the migration rule for this new class.
2.  Define a binding named `AI` to enable access to the neuron models.
3.  Since I want to use the Hono framework for routing, please help me install `hono` via npm and refactor `src/index.ts` to initialize a basic Hono app.

Constraint: Do not implement the logic yet. Focus only on valid configuration and basic Hono boilerplate export.

-----

Phase 2: Durable Object.

Create a new file `src/ChatRoom.ts`. Implement the `ChatRoom` class extending `DurableObject`.
This class must handle:
1.  Use `this.ctx.storage` to store an array of chat messages (history).
2.  -   Implement the `fetch` method to handle WebSocket upgrades.
    -   Manage WebSocket sessions (accept connection, add to a list of sessions).
    -   When a message is received from a user, push it to history, save to storage, and broadcast it to all other connected sessions.
3.  Ensure messages are stored as JSON strings.

Context: This DO acts as a single "chat room" instance where multiple users can talk, and the history is preserved even if the worker sleeps.


---

Phase 3: Streaming.

Update `src/index.ts` (the Hono app) and `src/ChatRoom.ts` to integrate Llama 3.3.

Requirements:
1.  Create a generic route `/api/chat` that upgrades the connection to the `ChatRoom` Durable Object.
2.  Inside the `ChatRoom` class, add logic to handle a special "AI trigger" (e.g., if a user message starts with "@ai").
3.  When the AI is triggered:
    -   Call `env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', ...)` with `stream: true`.
    -   Process the readable stream.
    -   As each chunk of text arrives from Llama 3, immediately send it via WebSocket to the client. Do not wait for the full response.

Technical constraint: Ensure proper error handling if the AI model fails or times out.

---

Phase 4: Frontend UI.

Create a `public/index.html` file containing a modern, clean Chat UI.
Features:
1.  It should connect to the Worker's WebSocket URL (ws://...).
2.  Display the chat history.
3.  Use a CDN library (like `marked`) to render the AI's Markdown responses nicely.
4.  Scroll to the bottom when new tokens stream in.

Update `src/index.ts` to serve this static HTML file on the root route `/`.

---

I am encountering a deployment error with Cloudflare Workers:
"[ERROR] In order to use Durable Objects with a free plan, you must create a namespace using a `new_sqlite_classes` migration. [code: 10097]"

Please update my `wrangler.toml` to comply with the new Cloudflare Free Tier requirements.
Action items:
1. Change the migration configuration. Instead of `new_classes`, use `new_sqlite_classes = ["ChatRoom"]`.
2. Ensure the `compatibility_date` is recent to support this feature.


---

My AI Assistant is behaving poorly:
1. It answers "What is the date?" with "I" or hallucinations because it lacks context.
2. The responses are cut off or too short.

Please refactor the `handleAIRequest` method in `src/ChatRoom.ts`:
1. Inject the current date/time into the system prompt message sent to the AI.
   Example: "You are a helpful assistant. Current date: ${new Date().toISOString()}."
2. Ensure we are correctly formatting the `messages` array passed to `env.AI.run`. It should include the system prompt first, followed by the user/assistant chat history.
3. Ensure the array follows the standard format: `[{ role: 'system', content: ... }, { role: 'user', content: ... }]`.

---

I need a way to reset the conversation when testing.

1. Update `src/ChatRoom.ts`: Handle a special command message. If the user sends a message with content `/reset`, the Durable Object should:
   - Clear the `this.history` array in memory.
   - Delete the storage using `this.ctx.storage.deleteAll()`.
   - Broadcast a system message saying "Chat history has been cleared."

2. Update `public/index.html`: Add a small "Trash Icon" or "Reset" button in the UI header. When clicked, it should send the `/reset` message via WebSocket.

---

I am implementing RAG (Retrieval Augmented Generation) for my chat app.
I have created a Cloudflare Vectorize index named "chat-index".

Please update my configuration:
1.  Add the `[[vectorize]]` binding.
    - binding name: `VECTORIZE`
    - index_name: "chat-index"
    (Note: Check if I need to add the specific `index_name` or strict configuration based on standard Cloudflare setup).

2.  Update the `Env` interface to include `VECTORIZE: VectorizeIndex`.

3.  Update the class to recognize this new binding in `this.env`.


---

Now implement the RAG logic in `src/ChatRoom.ts`.

1.  **Helper Method `generateEmbedding`:**
    Create a private method that takes a text string and returns a `number[]`.
    Use the model `@cf/baai/bge-base-en-v1.5` via `this.env.AI.run` to generate embeddings.

2.  Update `addMessageToHistory`:
    - Whenever a USER message is added, generate its embedding.
    - Insert it into `this.env.VECTORIZE` using `upsert`.
    - Use the message ID as the vector ID.
    - Store the message content in the vector metadata.

3.  Update `handleAIRequest`:
    - Before calling Llama 3, generate an embedding for the user's `prompt`.
    - Query `this.env.VECTORIZE` for the top 3 most similar vectors (`query()` method).
    - Extract the text from the matching vectors' metadata.
    - **Prompt Engineering:** Modify the `system` message sent to Llama 3. Append the retrieved context like this:
      "Context from previous conversations:\n- [Msg 1]\n- [Msg 2]..."

4.  Update `clearHistory` to also delete all vectors in the index.

---

## 🎯 RAG Implementation Results

### ✅ Successfully Implemented Features

1. **Vectorize Configuration**
   - Added `[[vectorize]]` binding in `wrangler.toml` with `remote = true`
   - Updated `Env` interface to include `VECTORIZE: VectorizeIndex`
   - Created Vectorize index: `chat-index` (768D, cosine metric)

2. **Embedding Generation**
   - Implemented `generateEmbedding()` method using `@cf/baai/bge-base-en-v1.5`
   - Returns 768-dimensional embeddings
   - Includes text truncation (1000 chars) to prevent oversized inputs
   - Robust error handling

3. **Message Storage with Embeddings**
   - Non-blocking background storage using async pattern
   - Strips `@ai` prefix from commands before storing
   - Stores metadata: content, username, timestamp
   - Uses message UUID as vector ID

4. **Context Retrieval (RAG Query)**
   - Generates query embedding for user prompts
   - Retrieves top 5 similar messages (increased from 3 for better context)
   - Filters by similarity threshold (score > 0.5)
   - Returns ranked results with similarity scores

5. **Enhanced Prompt Engineering**
   - Injects retrieved context into system prompt
   - Format: "IMPORTANT - Relevant information from previous messages..."
   - Explicit instruction for AI to use context
   - Maintains conversation flow with historical knowledge

6. **Vector Cleanup**
   - `clearHistory()` now deletes all vectors via `deleteByIds()`
   - Prevents orphaned embeddings in the index
   - Maintains consistency between chat history and vector store

### 🐛 Challenges & Solutions

**Challenge 1: Local Development Limitations**
- Problem: Vectorize binding not supported in local mode
- Solution: Added `remote = true` to binding configuration
- Result: RAG works in local dev with remote resources

**Challenge 2: WebSocket Disconnections**
- Problem: Embedding generation blocked WebSocket operations
- Solution: Made embedding storage non-blocking (fire-and-forget)
- Result: No more connection timeouts

**Challenge 3: Duplicate Messages**
- Problem: Sender received their own messages
- Solution: Excluded sender session in `broadcastMessage()`
- Result: Clean message flow

**Challenge 4: Debugging Visibility**
- Problem: Console logs not visible in Durable Objects (remote mode)
- Solution: Added debug message system that sends RAG info to chat UI
- Result: Full visibility into RAG operations (toggle-able)

**Challenge 5: Command Noise in Embeddings**
- Problem: `@ai` prefix stored in vectors, affecting similarity
- Solution: Strip command prefix before generating embeddings
- Result: Cleaner semantic matching

### 📊 Performance Metrics

- **Embedding Generation:** ~500-800ms per message
- **Vectorize Query:** ~200-400ms per search
- **Similarity Scores:** Typically 0.70-0.85 for relevant matches
- **Context Quality:** High - AI successfully recalls user preferences and facts

### 🔬 Test Results

**Test Case:** User Preference Memory
```
Input: "My name is Bach, I like coffee"
[Later]
Query: "@ai What do I like to drink?"
Result: ✅ AI correctly responded "You like coffee" 
Similarity Score: 0.751
```

**Test Case:** Multi-Context Retrieval
```
Messages: 
  - "I like coffee"
  - "I like pho"
Query: "@ai What do I like to drink?"
Result: ✅ Found 2 relevant contexts (scores: 0.753, 0.751)
AI Response: Accurate with both food and drink preferences
```

### 🎛️ Configuration Summary

```toml
# wrangler.toml
[ai]
binding = "AI"
remote = true

[[vectorize]]
binding = "VECTORIZE"
index_name = "chat-index"
remote = true
```

```typescript
// Key Parameters
- Embedding Model: @cf/baai/bge-base-en-v1.5
- Embedding Dimensions: 768
- Distance Metric: Cosine Similarity
- TopK Results: 5
- Similarity Threshold: 0.5
- LLM Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast
```

### 🚀 Future Enhancements

Potential improvements for production:
1. **Hybrid Search:** Combine semantic + keyword search
2. **User-Scoped Vectors:** Add user ID to metadata for personalized RAG
3. **Temporal Decay:** Weight recent messages higher
4. **Namespace Separation:** Separate indexes for different chat rooms
5. **Batch Embedding:** Process multiple messages together for efficiency
6. **Feedback Loop:** Track which contexts led to good AI responses