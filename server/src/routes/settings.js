import { Router } from 'express'
import { createWriteStream, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import prisma from '../lib/prisma.js'
import { verifyToken } from '../middleware/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = join(__dirname, '../../../uploads/logos')
mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, _file, cb) => cb(null, `${req.lawyerId}-logo-${Date.now()}.png`),
})
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }) // 2MB

const router = Router()
router.use(verifyToken)

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const lawyer = await prisma.lawyer.findUnique({
      where: { id: req.lawyerId },
      include: { settings: true },
    })
    if (!lawyer) return res.status(404).json({ error: 'Usuário não encontrado' })
    const { password, ...safe } = lawyer
    return res.json(safe)
  } catch {
    return res.status(500).json({ error: 'Erro ao carregar configurações' })
  }
})

// PUT /api/settings/account
router.put('/account', async (req, res) => {
  const { name, email, whatsapp } = req.body
  try {
    const lawyer = await prisma.lawyer.update({
      where: { id: req.lawyerId },
      data: { name, email, whatsapp },
    })
    const { password, ...safe } = lawyer
    return res.json(safe)
  } catch {
    return res.status(500).json({ error: 'Erro ao atualizar conta' })
  }
})

// PUT /api/settings/office
router.put('/office', async (req, res) => {
  const { cep, street, number, complement, neighborhood, city, state, specialties, logoUrl } = req.body
  try {
    const settings = await prisma.lawyerSettings.upsert({
      where: { lawyerId: req.lawyerId },
      update: { cep, street, number, complement, neighborhood, city, state, specialties, logoUrl },
      create: { lawyerId: req.lawyerId, cep, street, number, complement, neighborhood, city, state, specialties: specialties || [], logoUrl, workDays: [1, 2, 3, 4, 5] },
    })
    return res.json(settings)
  } catch {
    return res.status(500).json({ error: 'Erro ao atualizar escritório' })
  }
})

// PUT /api/settings/scheduler
router.put('/scheduler', async (req, res) => {
  const { schedulerSlug, slotDuration, highlightMessage } = req.body
  try {
    const settings = await prisma.lawyerSettings.upsert({
      where: { lawyerId: req.lawyerId },
      update: { schedulerSlug, slotDuration: Number(slotDuration), highlightMessage },
      create: { lawyerId: req.lawyerId, schedulerSlug, slotDuration: Number(slotDuration), highlightMessage, workDays: [1, 2, 3, 4, 5] },
    })
    return res.json(settings)
  } catch (err) {
    const msg = err.code === 'P2002' ? 'Esta URL já está em uso' : 'Erro ao atualizar agendador'
    return res.status(400).json({ error: msg })
  }
})

// PUT /api/settings/calendar
router.put('/calendar', async (req, res) => {
  const { workDays, workStartTime, workEndTime, hourlyRate } = req.body
  try {
    const settings = await prisma.lawyerSettings.upsert({
      where: { lawyerId: req.lawyerId },
      update: { workDays, workStartTime, workEndTime, hourlyRate: hourlyRate ? Number(hourlyRate) : null },
      create: { lawyerId: req.lawyerId, workDays, workStartTime, workEndTime, hourlyRate: hourlyRate ? Number(hourlyRate) : null },
    })
    return res.json(settings)
  } catch {
    return res.status(500).json({ error: 'Erro ao atualizar agenda' })
  }
})

// PUT /api/settings/financial
router.put('/financial', async (req, res) => {
  const { asaasApiKey } = req.body
  try {
    const settings = await prisma.lawyerSettings.upsert({
      where: { lawyerId: req.lawyerId },
      update: { asaasApiKey },
      create: { lawyerId: req.lawyerId, asaasApiKey, workDays: [1, 2, 3, 4, 5] },
    })
    return res.json({ ok: true, configured: !!settings.asaasApiKey })
  } catch {
    return res.status(500).json({ error: 'Erro ao salvar configuração' })
  }
})

// PUT /api/settings/alerts
router.put('/alerts', async (req, res) => {
  const { newBookingByEmail, newBookingByWhatsapp, cancellationByEmail, cancellationByWhatsapp } = req.body
  try {
    const settings = await prisma.lawyerSettings.upsert({
      where: { lawyerId: req.lawyerId },
      update: { newBookingByEmail, newBookingByWhatsapp, cancellationByEmail, cancellationByWhatsapp },
      create: { lawyerId: req.lawyerId, newBookingByEmail, newBookingByWhatsapp, cancellationByEmail, cancellationByWhatsapp, workDays: [1, 2, 3, 4, 5] },
    })
    return res.json(settings)
  } catch {
    return res.status(500).json({ error: 'Erro ao salvar alertas' })
  }
})

// POST /api/settings/logo
router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' })
  const logoUrl = `/uploads/logos/${req.file.filename}`
  prisma.lawyerSettings.upsert({
    where: { lawyerId: req.lawyerId },
    update: { logoUrl },
    create: { lawyerId: req.lawyerId, logoUrl, workDays: [1, 2, 3, 4, 5] },
  }).then(() => res.json({ logoUrl })).catch(() => res.status(500).json({ error: 'Erro ao salvar logo' }))
})

export default router
