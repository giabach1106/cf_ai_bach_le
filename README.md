# ⚡ EdgeMind: Cloudflare AI Research Agent

EdgeMind is a serverless, real-time AI chat application built on the **Cloudflare Developer Platform**. It demonstrates the power of Edge Computing by combining **Durable Objects** for stateful consistency, **Workers AI (Llama 3.3)** for low-latency intelligence, and **Vectorize** for RAG-powered contextual memory.

## 🚀 Key Features

* **🧠 Edge Intelligence:** Powered by **Llama 3.3 (FP8)** running directly on Cloudflare Workers AI.
* **🔍 RAG Memory System:** Uses **Cloudflare Vectorize** and embeddings (@cf/baai/bge-base-en-v1.5) to give the AI long-term contextual memory.
* **📦 GitHub Repository Analysis:** Analyze any GitHub repo with `/analyze` command - generates AI summaries with **interactive Mind Map** visualizations.
* **📊 Mermaid Diagrams:** Full support for Mermaid diagrams with **fullscreen zoom**, pan, and **PNG download** capabilities.
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

### 📦 Analyze GitHub Repositories (NEW!)
Analyze any GitHub repository and get an AI-generated summary with an interactive Mind Map visualization!

1. Use the `/analyze` command followed by a GitHub URL
2. Example: `/analyze https://github.com/AsyncFuncAI/deepwiki-open`
3. The AI will:
   - Fetch the README from GitHub API
   - Generate a **Mermaid Mind Map** showing project structure
   - Provide a comprehensive summary with features, tech stack, and more

**Supported URL formats:**
```
/analyze https://github.com/owner/repo
/analyze github.com/owner/repo
/analyze https://github.com/owner/repo.git
```

**Example Output:**
```
📦 Repository Analysis: owner/repo

[Interactive Mind Map Diagram]
   ┌─────────────┐
   │  Project    │
   │   Name      │
   └──────┬──────┘
          │
    ┌─────┴─────┬─────────┬──────────┐
    ▼           ▼         ▼          ▼
 Features   Tech Stack  Setup    Notable
    │           │         │          │
   ...         ...       ...        ...

🎯 Project Overview
Brief description of the project...

✨ Key Features
• Feature 1: Description
• Feature 2: Description

🛠️ Tech Stack
Languages, frameworks, tools...

🚀 Getting Started
Installation and usage...
```

### 🔍 Diagram Zoom & Export
All Mermaid diagrams support interactive features:

1. **Hover** over any diagram to reveal the zoom button (🔍)
2. **Click** the zoom button to open fullscreen modal
3. **Keyboard shortcuts** in fullscreen:
   - `+` / `=` : Zoom in
   - `-` : Zoom out
   - `0` : Reset zoom
   - `Esc` : Close modal
4. **Download** diagrams as high-resolution PNG images

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

### 📦 GitHub Repository Analysis (Latest)
- ✅ **`/analyze` Command:** Analyze any GitHub repository with a single command
- ✅ **AI Summarization:** Llama 3.3 generates comprehensive summaries from README files
- ✅ **Mind Map Generation:** Automatic Mermaid mind map diagrams for visual project overview
- ✅ **Interactive Diagrams:** Click-to-zoom, keyboard controls, and PNG export
- ✅ **Error Handling:** Graceful handling of invalid URLs, missing READMEs, and rate limits

### 🎯 Production-Ready Fixes
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

### Bước 1: Đăng nhập Cloudflare

```bash
npx wrangler login
```

Lệnh này sẽ mở browser để bạn đăng nhập vào Cloudflare account. Sau khi đăng nhập thành công, Wrangler sẽ lưu credentials.

### Bước 2: Tạo Vectorize Index (Nếu chưa có)

Vectorize index cần thiết cho tính năng RAG. Kiểm tra xem đã có chưa:

```bash
npx wrangler vectorize list
```

Nếu chưa có index `chat-index`, tạo mới:

```bash
npx wrangler vectorize create chat-index --dimensions=768 --metric=cosine
```

**Lưu ý:** Vectorize hiện tại chỉ có sẵn trên **paid plans** (Workers Paid hoặc Enterprise). Nếu bạn dùng free plan, RAG sẽ không hoạt động nhưng các tính năng khác vẫn chạy bình thường.

### Bước 3: Deploy Worker

```bash
npm run deploy
```

Hoặc:

```bash
npx wrangler deploy
```

Quá trình deploy sẽ:
- ✅ Build TypeScript code
- ✅ Upload assets từ `public/` folder
- ✅ Deploy Worker với tên `main` (có thể đổi trong `wrangler.toml`)
- ✅ Tạo Durable Objects namespace
- ✅ Bind Workers AI, Vectorize, và Assets

### Bước 4: Verify Deployment

Sau khi deploy thành công, bạn sẽ nhận được URL như:
```
https://main.your-subdomain.workers.dev
```

**Test các tính năng:**
1. ✅ Mở URL trong browser
2. ✅ Test chat với `@ai` command
3. ✅ Test GitHub analysis với `/analyze https://github.com/owner/repo`
4. ✅ Test Mind Map zoom và download
5. ✅ Test clear chat để verify vector cleanup

### Bước 5: Custom Domain (Optional)

Nếu muốn dùng custom domain:

1. Thêm domain vào Cloudflare Dashboard
2. Tạo CNAME record trỏ đến worker
3. Hoặc dùng Cloudflare Workers Routes

### Troubleshooting Deployment

**Lỗi: "Vectorize index not found"**
```bash
# Tạo index nếu chưa có
npx wrangler vectorize create chat-index --dimensions=768 --metric=cosine
```

**Lỗi: "Durable Objects migration failed"**
- Đảm bảo `wrangler.toml` có đúng migrations config
- Nếu đã deploy trước đó, có thể cần update migration tag

**Lỗi: "Workers AI not available"**
- Workers AI cần account có access (thường là paid plans)
- Kiểm tra trong Cloudflare Dashboard → Workers → AI

**Lỗi: "Assets binding failed"**
- Đảm bảo folder `public/` tồn tại và có file `index.html`
- Kiểm tra `wrangler.toml` có đúng `[assets]` config

### Production Checklist

Trước khi deploy production, đảm bảo:

- [ ] ✅ Đã test tất cả features local (`npm run dev`)
- [ ] ✅ Vectorize index đã được tạo
- [ ] ✅ Workers AI binding hoạt động
- [ ] ✅ Durable Objects migrations đúng
- [ ] ✅ Assets folder có đầy đủ files
- [ ] ✅ Environment variables (nếu có) đã set trong Cloudflare Dashboard

### Update Deployment

Khi có code mới, chỉ cần chạy lại:

```bash
npm run deploy
```

Wrangler sẽ tự động:
- Detect changes
- Build và upload code mới
- Update worker không cần downtime

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