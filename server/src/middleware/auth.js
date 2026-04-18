import jwt from 'jsonwebtoken'

export function verifyToken(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' })
  }
  const token = auth.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.lawyerId = payload.sub
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}
