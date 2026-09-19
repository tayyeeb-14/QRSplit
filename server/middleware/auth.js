import jwt from 'jsonwebtoken'
import { Merchant } from '../models/models.js'

export async function authMiddleware(req, res, next) {
  const value = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!value) return res.status(401).json({ success: false, message: 'Authentication required', error: 'Missing bearer token' })
  try {
    const payload = jwt.verify(value, process.env.JWT_SECRET)
    const merchant = await Merchant.findOne({ merchantId: payload.merchantId }).select('+passwordHash')
    if (!merchant || merchant.status !== 'ACTIVE') return res.status(401).json({ success: false, message: 'Merchant not found or inactive', error: 'Unauthorized' })
    req.merchant = merchant
    req.auth = payload
    return next()
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token', error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Unauthorized' })
  }
}

export function adminMiddleware(req, res, next) {
  if (req.merchant?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required', error: 'Forbidden' })
  return next()
}
