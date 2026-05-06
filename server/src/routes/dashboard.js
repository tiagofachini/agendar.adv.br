import { Router } from 'express'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from 'date-fns'
import prisma from '../lib/prisma.js'
import { verifyToken } from '../middleware/auth.js'

const router = Router()
router.use(verifyToken)

function getPeriodRange(period) {
  const now = new Date()
  switch (period) {
    case 'week':  return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'month': return { gte: startOfMonth(now), lte: endOfMonth(now) }
    default:      return { gte: startOfDay(now), lte: endOfDay(now) } // day
  }
}

// GET /api/dashboard?period=day|week|month
router.get('/', async (req, res) => {
  const lawyerId = req.lawyerId
  const period = req.query.period || 'day'
  const range = getPeriodRange(period)
  const today = { gte: startOfDay(new Date()), lte: endOfDay(new Date()) }
  const tomorrow = {
    gte: startOfDay(addDays(new Date(), 1)),
    lte: endOfDay(addDays(new Date(), 1)),
  }

  try {
    const [todayCount, tomorrowCount, nextAppointment, receivables, newClients, newAppointments] =
      await Promise.all([
        // Compromissos hoje
        prisma.appointment.count({
          where: { lawyerId, date: today, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
        }),
        // Compromissos amanhã
        prisma.appointment.count({
          where: { lawyerId, date: tomorrow, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
        }),
        // Próximo compromisso
        prisma.appointment.findFirst({
          where: { lawyerId, date: { gte: new Date() }, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
          orderBy: { date: 'asc' },
          select: { date: true, clientName: true, specialty: true },
        }),
        // Recebíveis no período (pagamentos PAID)
        prisma.payment.aggregate({
          where: { lawyerId, status: 'PAID', paidAt: range },
          _sum: { amount: true },
        }),
        // Novos clientes no período
        prisma.client.count({ where: { lawyerId, createdAt: range } }),
        // Novos compromissos no período
        prisma.appointment.count({ where: { lawyerId, createdAt: range } }),
      ])

    return res.json({
      todayCount,
      tomorrowCount,
      nextAppointment,
      receivables: Number(receivables._sum.amount || 0),
      newClients,
      newAppointments,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao carregar dashboard' })
  }
})

export default router
