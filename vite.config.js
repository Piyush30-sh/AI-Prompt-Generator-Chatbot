import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

function groqProxy() {
  return {
    name: 'groq-proxy',
    configureServer(server) {
      server.middlewares.use('/api/groq', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.end('Method not allowed')
          return
        }

        let apiKey = process.env.GROQ_API_KEY
        let model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'

        try {
          const envLocalPath = `${process.cwd()}/.env.local`
          if (fs.existsSync(envLocalPath)) {
            const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n')
            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('GROQ_API_KEY=')) {
                apiKey = trimmed.replace('GROQ_API_KEY=', '').trim()
              } else if (trimmed.startsWith('GROQ_MODEL=')) {
                model = trimmed.replace('GROQ_MODEL=', '').trim()
              }
            }
          }
        } catch (e) {
          console.error('[groq-proxy] Error reading .env.local:', e)
        }

        console.log('[groq-proxy] Using key starting with:', apiKey ? apiKey.substring(0, 10) : 'none', 'and model:', model)

        if (!apiKey) {
          response.statusCode = 500
          response.end(JSON.stringify({ error: 'GROQ_API_KEY is missing' }))
          return
        }

        let body = ''
        request.on('data', (chunk) => { body += chunk })
        request.on('end', async () => {
          try {
            const { system, messages, max_tokens } = JSON.parse(body)
            const tokenLimit = max_tokens || 600
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model,
                temperature: 0.3,
                max_tokens: tokenLimit,
                response_format: { type: 'json_object' },
                messages: [{ role: 'system', content: system }, ...messages]
              }),
            })
            const respText = await groqResponse.text()
            if (!groqResponse.ok) {
              console.error(`[groq-proxy error] ${groqResponse.status}: ${respText}`)
            }
            response.statusCode = groqResponse.status
            response.setHeader('Content-Type', 'application/json')
            response.end(respText)
          } catch (error) {
            console.error('[groq-proxy exception]', error)
            response.statusCode = 500
            response.end(JSON.stringify({ error: error.message }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react(), groqProxy()],
  }
})
