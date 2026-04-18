import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

import authRouter from './routes/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

// ── Rotas da API ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from API' })
})

// ── Servir frontend em produção ───────────────────────────────────────────────
const clientDist = join(__dirname, '../../client/dist')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
