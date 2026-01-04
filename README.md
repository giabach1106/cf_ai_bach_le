# ⚡ EdgeMind: Cloudflare AI Research Agent

EdgeMind is a serverless, real-time AI chat application built on the **Cloudflare Developer Platform**. It demonstrates the power of Edge Computing by combining **Durable Objects** for stateful consistency and **Workers AI (Llama 3.3)** for low-latency intelligence.

## 🚀 Key Features

* **🧠 Edge Intelligence:** Powered by **Llama 3.3 (FP8)** running directly on Cloudflare Workers AI.
* **⚡ Real-time Streaming:** Zero-latency token streaming via Server-Sent Events (SSE) over WebSockets.
* **💾 Stateful Architecture:** Uses **Durable Objects** to maintain chat history and state consistency across global edge locations.
* **🎨 Modern UI:** A responsive, glassmorphism-inspired interface with Markdown rendering and auto-scroll.

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

## 🤖 AI Assistance
See [PROMPTS.md](./PROMPTS.md) for the detailed engineering logs and prompts used to architect this solution.