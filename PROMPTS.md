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