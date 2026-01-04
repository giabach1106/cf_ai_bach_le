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