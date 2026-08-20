import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()

const signToken = (lawyerId) =>
  jwt.sign({ sub: lawyerId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })

const sanitize = ({ password, ...lawyer }) => lawyer

const createDefaultSettings = (lawyerId) =>
  prisma.lawyerSettings.create({
    data: { lawyerId, workDays: [1, 2, 3, 4, 5] },
  })

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, whatsapp, password } = req.body
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email e password são obrigatórios' })

  try {
    const exists = await prisma.lawyer.findUnique({ where: { email } })
    if (exists) return res.status(409).json({ error: 'Email já cadastrado' })

    const hashed = await bcrypt.hash(password, 10)
    const lawyer = await prisma.lawyer.create({
      data: { name, email, whatsapp, password: hashed },
    })
    await createDefaultSettings(lawyer.id)

    return res.status(201).json({ token: signToken(lawyer.id), lawyer: sanitize(lawyer) })
  } catch {
    return res.status(500).json({ error: 'Erro ao cadastrar' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'email e password são obrigatórios' })

  try {
    const lawyer = await prisma.lawyer.findUnique({ where: { email } })
    if (!lawyer?.password)
      return res.status(401).json({ error: 'Credenciais inválidas' })

    const valid = await bcrypt.compare(password, lawyer.password)
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' })

    return res.json({ token: signToken(lawyer.id), lawyer: sanitize(lawyer) })
  } catch {
    return res.status(500).json({ error: 'Erro ao autenticar' })
  }
})

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const lawyer = await prisma.lawyer.findUnique({
      where: { id: req.lawyerId },
      include: { settings: true },
    })
    if (!lawyer) return res.status(404).json({ error: 'Usuário não encontrado' })
    return res.json(sanitize(lawyer))
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar usuário' })
  }
})

export default router
