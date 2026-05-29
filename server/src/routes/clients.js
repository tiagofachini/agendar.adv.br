import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()
router.use(verifyToken)

// GET /api/clients/stats — deve vir ANTES de /:id
router.get('/stats', async (req, res) => {
  const now = new Date()
  const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  try {
    const [total, past30Count, next30Count] = await Promise.all([
      prisma.client.count({ where: { lawyerId: req.lawyerId } }),
      prisma.client.count({
        where: {
          lawyerId: req.lawyerId,
          appointments: {
            some: { date: { gte: past30, lte: now }, status: { not: 'CANCELLED' } },
          },
        },
      }),
      prisma.client.count({
        where: {
          lawyerId: req.lawyerId,
          appointments: {
            some: {
              date: { gte: now, lte: next30 },
              status: { notIn: ['CANCELLED', 'EXPIRED'] },
            },
          },
        },
      }),
    ])
    return res.json({ total, past30: past30Count, next30: next30Count })
  } catch {
    return res.status(500).json({ error: 'Erro ao carregar estatísticas' })
  }
})

// GET /api/clients?search=&page=&city=&state=&specialty=
router.get('/', async (req, res) => {
  const { search = '', page = 1, limit = 30, city = '', state = '', specialty = '' } = req.query
  const skip = (Number(page) - 1) * Number(limit)
  const where = {
    lawyerId: req.lawyerId,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(city && { city: { contains: city, mode: 'insensitive' } }),
    ...(state && { state: { equals: state.toUpperCase() } }),
    ...(specialty && {
      appointments: { some: { specialty: { contains: specialty, mode: 'insensitive' } } },
    }),
  }

  try {
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: Number(limit),
        include: {
          _count: { select: { appointments: true, payments: true } },
        },
      }),
      prisma.client.count({ where }),
    ])
    return res.json({ clients, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch {
    return res.status(500).json({ error: 'Erro ao listar clientes' })
  }
})

// GET /api/clients/:id — detalhe com histórico
router.get('/:id', async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, lawyerId: req.lawyerId },
      include: {
        appointments: { orderBy: { date: 'desc' }, take: 20 },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' })
    return res.json(client)
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar cliente' })
  }
})

// POST /api/clients
router.post('/', async (req, res) => {
  const { name, email, whatsapp, cep, street, number, complement, neighborhood, city, state } = req.body
  if (!name || !email) return res.status(400).json({ error: 'name e email são obrigatórios' })

  try {
    const exists = await prisma.client.findUnique({
      where: { lawyerId_email: { lawyerId: req.lawyerId, email } },
    })
    if (exists) return res.status(409).json({ error: 'Cliente com este email já cadastrado' })

    const client = await prisma.client.create({
      data: { lawyerId: req.lawyerId, name, email, whatsapp, cep, street, number, complement, neighborhood, city, state },
    })
    return res.status(201).json(client)
  } catch {
    return res.status(500).json({ error: 'Erro ao criar cliente' })
  }
})

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  const { name, email, whatsapp, cep, street, number, complement, neighborhood, city, state } = req.body
  try {
    const exists = await prisma.client.findFirst({
      where: { id: req.params.id, lawyerId: req.lawyerId },
    })
    if (!exists) return res.status(404).json({ error: 'Cliente não encontrado' })
    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: { name, email, whatsapp, cep, street, number, complement, neighborhood, city, state },
    })
    return res.json(updated)
  } catch {
    return res.status(500).json({ error: 'Erro ao atualizar cliente' })
  }
})

export default router
