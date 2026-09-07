# Prompt Distillery

A React prompt-generation chatbot with Quick mode and Groq-powered Smart mode.

## Run locally

1. Copy `.env.example` to `.env.local`.
2. Set `GROQ_API_KEY` to your Groq API key. Keep this file private.
3. Run `npm run dev` and open the local Vite URL.

Quick mode works without an API key. Smart mode uses the local `/api/groq` Vite middleware, so the key is never sent to the browser.

The included proxy is for local development. For deployment, move the same Groq request into a serverless function or backend route and keep `GROQ_API_KEY` in the host's secret settings.
