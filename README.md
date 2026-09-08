# AI Prompt Generator Chatbot

AI Prompt Generator Chatbot is a React-based prompt engineering tool. Its interface, **Prompt Distillery**, turns rough ideas into structured, production-ready prompts through a guided chat workflow.

## Features

- **Smart mode** powered by Groq for dynamic prompt discovery and refinement.
- **Quick mode** that generates prompts locally without an API key.
- Guided collection of the task, role, tone, output format, and constraints.
- Starter goals and one-click refinement suggestions.
- Production prompt preview with word and character counts.
- Copy-to-clipboard support for generated prompts.
- Server-side Groq integration so the API key is never sent to the browser.

## Tech Stack

- React 19
- Vite 8
- Groq Chat Completions API
- Vercel serverless functions

## Run Locally

### Prerequisites

- Node.js 18 or newer
- A Groq API key for Smart mode

### Setup

```bash
npm install
```

Create `.env.local` from `.env.example` and add your Groq credentials:

```dotenv
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown by Vite. Quick mode works without a Groq key; Smart mode uses the `/api/groq` route.

## Available Scripts

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production build
npm run preview   # Preview the production build locally
npm run lint      # Run Oxlint
```

## Deploy to Vercel

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Add these environment variables under **Project Settings > Environment Variables** for the **Production** environment:

	```text
	GROQ_API_KEY=your_groq_api_key_here
	GROQ_MODEL=qwen/qwen3.8-27b
	```

4. Redeploy the project after saving the variables.

The production API handler is located at `api/groq.js`. Never commit `.env.local` or expose the Groq key in client-side code. If a key has been shared publicly, revoke it and create a replacement in Groq.

## Project Structure

```text
api/groq.js       Vercel serverless route for Groq requests
src/App.jsx       Main chatbot interface and prompt-generation logic
src/App.css       Chatbot and prompt preview styling
src/index.css     Global styles
src/main.jsx      React entry point
vite.config.js    Vite configuration and local API middleware
```
