# ⚡ EdgeMind: Cloudflare AI Research Agent

EdgeMind is a serverless, real-time AI chat application built on the **Cloudflare Developer Platform**. It demonstrates the power of Edge Computing by combining **Durable Objects** for stateful consistency and **Workers AI (Llama 3.3)** for low-latency intelligence.

## 🚀 Key Features

* **🧠 Edge Intelligence:** Powered by **Llama 3.3 (FP8)** running directly on Cloudflare Workers AI.
* **⚡ Real-time Streaming:** Zero-latency token streaming directly to WebSocket clients.
* **💾 Stateful Architecture:** Uses **Durable Objects** to maintain chat history and state consistency across global edge locations.
* **🎨 Modern UI:** A responsive, glassmorphism-inspired interface with Markdown rendering and auto-scroll.
* **🗑️ Clear Chat:** Ability to clear chat history for all users with one click.
* **🔄 Auto-reconnect:** Automatic reconnection handling with up to 5 retry attempts.

## 🛠️ Tech Stack

* **Runtime:** Cloudflare Workers
* **Framework:** Hono (TypeScript)
* **State:** Cloudflare Durable Objects
* **AI Inference:** Workers AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast)
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

3.  **Start Development Server**
    ```bash
    npm run dev
    ```
    Visit `http://localhost:8787` to start chatting.

## 📖 How to Use

### Chat with Other Users
1. Enter your username in the left input field
2. Type your message in the main input field
3. Press **Enter** or click **Send**
4. Your messages will be broadcast to all connected users

### Ask the AI Assistant
1. Start your message with `@ai` followed by your question
2. Example: `@ai What is Cloudflare Workers?`
3. The AI will respond with streaming text in real-time
4. AI responses support **Markdown formatting** including:
   - Code blocks with syntax highlighting
   - Bold, italic, lists
   - Links and more

### Clear Chat History
1. Click the **🗑️ Clear Chat** button in the header
2. Confirm the action
3. All messages will be deleted for all users
4. A system notification will announce the action

## 🔧 Recent Fixes

### Fixed AI Streaming Issues
- ✅ Fixed incomplete AI responses (was only showing partial text)
- ✅ Properly parse Workers AI streaming format using async iteration
- ✅ Removed incorrect SSE parsing that caused truncated responses

### Added Clear Chat Feature
- ✅ Added clear history command handler in Durable Object
- ✅ Added clear button in UI header
- ✅ Broadcasts clear notification to all connected users
- ✅ Includes confirmation dialog to prevent accidental deletion

## 🤖 AI Assistance
See [PROMPTS.md](./PROMPTS.md) for the detailed engineering logs and prompts used to architect this solution.