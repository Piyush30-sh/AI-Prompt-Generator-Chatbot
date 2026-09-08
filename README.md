# Prompt Distillery

A React prompt-generation chatbot with Quick mode and Groq-powered Smart mode.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `GROQ_API_KEY` to your Groq API key. Keep this file private.
3. Run `npm run dev` and open the local Vite URL.

Quick mode works without an API key. Smart mode uses the `/api/groq` server route, so the key is never sent to the browser.

For Vercel, add `GROQ_API_KEY` and optionally `GROQ_MODEL` in Project Settings > Environment Variables, then redeploy. The default model is `qwen/qwen3.8-27b`.
