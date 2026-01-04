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
4. All vector embeddings will be removed from Vectorize
5. A system notification will announce the action

## 🔧 Recent Updates

### ✨ RAG Implementation (Latest)
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
2. Find line ~270
3. Change `const ENABLE_RAG_DEBUG = false;` to `true`
4. Restart the dev server

You'll see messages like:
- 🔍 Generating embedding...
- 🔎 Querying Vectorize...
- 📝 Match results with similarity scores
- ✅ Context usage confirmation

## 🤖 AI Assistance
See [PROMPTS.md](./PROMPTS.md) for the detailed engineering logs and prompts used to architect this solution.