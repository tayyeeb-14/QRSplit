import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) })
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { Merchant, User, QrToken, PaymentRequest, Transaction, GroupSplit } from './models/models.js'
import { splitAmount } from './services/splitService.js'
import { authMiddleware, adminMiddleware } from './middleware/auth.js'
import { validVpa, verifyMerchantUpi } from './services/verificationService.js'

const app = express()
app.use(helmet())
const configuredClientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
const allowedClientOrigins = new Set([configuredClientUrl, 'http://localhost:5173', 'http://localhost:5174'])
app.use(cors({ origin: (origin, callback) => { if (!origin || allowedClientOrigins.has(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS')) } }))
app.use(express.json({ limit: '100kb' }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false }))

const ok = (res, data, message = 'Success') => res.json({ success: true, message, data })
const fail = (res, status, message, error = message) => res.status(status).json({ success: false, message, error })
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const publicMerchant = merchant => ({ merchantId: merchant.merchantId, businessName: merchant.businessName, ownerName: merchant.ownerName, upiId: merchant.upiId, profileImage: merchant.profileImage, status: merchant.status, verificationStatus: merchant.verificationStatus, verificationSource: merchant.verificationSource, verifiedAt: merchant.verifiedAt, createdAt: merchant.createdAt })
const privateMerchant = merchant => ({ ...publicMerchant(merchant), email: merchant.email, phone: merchant.phone, role: merchant.role })
const makeMerchantId = upiId => { const prefix = String(upiId).split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 3).padEnd(3, 'x').toUpperCase(); return `MCH-${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}` }
const makeJwt = merchant => jwt.sign({ userId: merchant._id.toString(), merchantId: merchant.merchantId, role: merchant.role }, process.env.JWT_SECRET, { expiresIn: '2h' })
const hashToken = value => crypto.createHash('sha256').update(value).digest('hex')
const newQrToken = () => crypto.randomBytes(24).toString('hex')
const amountCents = value => { const number = Number(value); if (!Number.isFinite(number) || number <= 0) throw new Error('Amount must be positive'); return Math.round(number * 100) }
const toPublicRequest = item => ({ id: item._id, amount: item.amountCents / 100, description: item.description, status: item.status, createdAt: item.createdAt, tranches: item.tranches.map(tranche => ({ id: tranche._id, amount: tranche.amountCents / 100, status: tranche.status, reference: tranche.reference, paymentIntent: tranche.paymentIntent })) })
const validUpi = value => /^[\w.-]+@[\w.-]+$/.test(String(value || ''))

async function createQr(merchant) {
  const token = newQrToken()
  await QrToken.updateMany({ merchant: merchant._id, revokedAt: null }, { revokedAt: new Date() })
  await QrToken.create({ merchant: merchant._id, tokenHash: hashToken(token) })
  return { token, url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/m/${token}` }
}

app.get('/api/health', (_, res) => ok(res, { service: 'SplitPay API', mode: 'simulation', persistence: 'mongodb' }))
app.post('/api/merchant/verify-upi', wrap(async (req, res) => {
  const { upiId, storeName = '' } = req.body || {}
  if (!validVpa(upiId)) return fail(res, 422, 'Enter a valid UPI ID (VPA).')
  const existing = await Merchant.findOne({ upiId: String(upiId).trim().toLowerCase() })
  if (existing) return ok(res, { existing: true, merchant: publicMerchant(existing), message: 'Existing merchant profile found.' }, 'Merchant found')
  const result = verifyMerchantUpi(upiId, storeName)
  return ok(res, { existing: false, verification: result }, result.verified ? 'Merchant identity verified in the demo directory' : 'UPI details detected')
}))
app.post('/api/auth/register', wrap(async (req, res) => {
  const { businessName, ownerName, upiId, email, phone, password, verification } = req.body || {}
  if (!upiId || !email || !password) return fail(res, 400, 'UPI ID, email and password are required')
  if (!validUpi(upiId)) return fail(res, 422, 'Enter a valid UPI ID')
  if (String(password).length < 8) return fail(res, 422, 'Password must be at least 8 characters')
  const normalizedEmail = String(email).trim().toLowerCase()
  const normalizedUpi = String(upiId).trim().toLowerCase()
  const duplicateUpi = await Merchant.exists({ upiId: normalizedUpi })
  if (duplicateUpi) return fail(res, 409, 'A merchant profile already exists for this UPI ID.', 'Duplicate UPI ID')
  const duplicateEmail = await Merchant.exists({ email: normalizedEmail })
  if (duplicateEmail) return fail(res, 409, 'Email already registered.', 'Duplicate email')
  const verified = verifyMerchantUpi(normalizedUpi, businessName)
  const isVerified = verified.verified
  const resolvedName = verified.name || businessName || normalizedUpi.split('@')[0]
  let merchant
  try {
    merchant = await Merchant.create({ merchantId: makeMerchantId(normalizedUpi), businessName: resolvedName, ownerName, upiId: normalizedUpi, email, phone, passwordHash: await bcrypt.hash(password, 12), verificationStatus: isVerified ? 'verified' : 'unverified', verificationSource: isVerified ? verified.source : 'qr-input', verifiedAt: isVerified ? new Date() : undefined })
    await User.create({ merchant: merchant._id, role: merchant.role })
    const qr = await createQr(merchant)
    return ok(res, { merchant: privateMerchant(merchant), qr, token: makeJwt(merchant) }, 'Merchant profile created successfully')
  } catch (error) {
    if (merchant?._id) {
      await Promise.all([User.deleteMany({ merchant: merchant._id }), QrToken.deleteMany({ merchant: merchant._id }), Merchant.deleteOne({ _id: merchant._id })])
    }
    throw error
  }
}))
app.post('/api/auth/login', wrap(async (req, res) => {
  const merchant = await Merchant.findOne({ $or: [{ email: String(req.body?.identifier || '').toLowerCase() }, { phone: req.body?.identifier }] }).select('+passwordHash')
  if (!merchant || !(await bcrypt.compare(req.body?.password || '', merchant.passwordHash))) return fail(res, 401, 'Invalid credentials')
  await User.findOneAndUpdate({ merchant: merchant._id }, { lastLoginAt: new Date() })
  return ok(res, { merchant: privateMerchant(merchant), token: makeJwt(merchant) }, 'Logged in')
}))
app.post('/api/auth/logout', authMiddleware, (_, res) => ok(res, null, 'Logged out'))
app.get('/api/auth/me', authMiddleware, (req, res) => ok(res, privateMerchant(req.merchant)))

app.get('/api/merchant/me', authMiddleware, (req, res) => ok(res, privateMerchant(req.merchant)))
app.put('/api/merchant/me', authMiddleware, wrap(async (req, res) => { const allowed = ['businessName', 'ownerName', 'phone', 'profileImage']; const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key))); const merchant = await Merchant.findByIdAndUpdate(req.merchant._id, updates, { new: true, runValidators: true }); return ok(res, publicMerchant(merchant), 'Profile updated') }))
app.get('/api/merchant/resolve/:token', wrap(async (req, res) => { const qr = await QrToken.findOne({ tokenHash: hashToken(req.params.token), revokedAt: null }).populate('merchant'); const merchant = qr?.merchant || await Merchant.findOne({ merchantId: req.params.token }); if (!merchant || merchant.status !== 'ACTIVE') return fail(res, 404, 'Merchant profile not found'); return ok(res, publicMerchant(merchant)) }))
app.post('/api/merchant/regenerate-qr', authMiddleware, wrap(async (req, res) => ok(res, await createQr(req.merchant), 'Merchant QR regenerated')))
app.post('/api/merchant/revoke-qr', authMiddleware, wrap(async (req, res) => { await QrToken.updateMany({ merchant: req.merchant._id, revokedAt: null }, { revokedAt: new Date() }); return ok(res, null, 'Merchant QR revoked') }))

app.post('/api/payment-requests', authMiddleware, wrap(async (req, res) => {
  try {
    const { amount, count = 1, description = '' } = req.body || {}
    const cents = amountCents(amount)
    const values = splitAmount(cents / 100, count)
    const request = await PaymentRequest.create({ merchant: req.merchant._id, description, amountCents: cents, tranches: values.map((value, index) => { const reference = `SP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${index + 1}`; const query = new URLSearchParams({ pa: req.merchant.upiId, pn: req.merchant.businessName, am: value.toFixed(2), cu: 'INR', tr: reference }); return { amountCents: Math.round(value * 100), status: 'PENDING', reference, paymentIntent: `upi://pay?${query.toString()}` } }) })
    await Transaction.insertMany(request.tranches.map(tranche => ({ merchant: req.merchant._id, paymentRequest: request._id, trancheId: tranche._id, transactionId: `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, amountCents: tranche.amountCents, description, status: 'PENDING', paymentReference: tranche.reference })))
    return ok(res, toPublicRequest(request), 'Payment requests created')
  } catch (error) { return fail(res, 400, error.message) }
}))
app.get('/api/payment-requests', authMiddleware, wrap(async (req, res) => ok(res, (await PaymentRequest.find({ merchant: req.merchant._id }).sort({ createdAt: -1 })).map(toPublicRequest))))
app.get('/api/payment-requests/:id', authMiddleware, wrap(async (req, res) => { const item = await PaymentRequest.findOne({ _id: req.params.id, merchant: req.merchant._id }); if (!item) return fail(res, 404, 'Payment request not found'); return ok(res, toPublicRequest(item)) }))
app.get('/api/payment-requests/:id/tranches', authMiddleware, wrap(async (req, res) => { const item = await PaymentRequest.findOne({ _id: req.params.id, merchant: req.merchant._id }); if (!item) return fail(res, 404, 'Payment request not found'); return ok(res, item.tranches) }))

async function simulateTranche(req, res, status) {
  const request = await PaymentRequest.findOne({ merchant: req.merchant._id, 'tranches._id': req.params.id })
  if (!request) return fail(res, 404, 'Payment tranche not found')
  const tranche = request.tranches.id(req.params.id)
  if (!['PENDING', 'PROCESSING'].includes(tranche.status)) return fail(res, 409, 'Invalid payment state transition')
  tranche.status = status
  tranche.processedAt = new Date()
  const statuses = request.tranches.map(item => item.status)
  request.status = statuses.every(item => item === 'SUCCESS') ? 'SUCCESS' : statuses.some(item => item === 'FAILED') ? 'FAILED' : statuses.some(item => item === 'PROCESSING') ? 'PROCESSING' : 'PENDING'
  await request.save()
  await Transaction.findOneAndUpdate({ paymentRequest: request._id, trancheId: tranche._id }, { status, processedAt: tranche.processedAt })
  return ok(res, toPublicRequest(request), `Payment marked ${status.toLowerCase()}`)
}
app.post('/api/tranches/:id/simulate-success', authMiddleware, wrap((req, res) => simulateTranche(req, res, 'SUCCESS')))
app.post('/api/tranches/:id/simulate-failure', authMiddleware, wrap((req, res) => simulateTranche(req, res, 'FAILED')))

app.get('/api/transactions', authMiddleware, wrap(async (req, res) => {
  const { status, search, page = 1, limit = 10, from, to } = req.query
  const query = { merchant: req.merchant._id }
  if (status && status !== 'ALL') query.status = status.toUpperCase()
  if (search) query.$or = [{ transactionId: new RegExp(String(search), 'i') }, { description: new RegExp(String(search), 'i') }, { paymentReference: new RegExp(String(search), 'i') }]
  if (from || to) query.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) }
  const size = Math.min(50, Math.max(1, Number(limit))); const current = Math.max(1, Number(page)); const [items, total] = await Promise.all([Transaction.find(query).sort({ createdAt: -1 }).skip((current - 1) * size).limit(size), Transaction.countDocuments(query)])
  return ok(res, { items, pagination: { page: current, limit: size, total, pages: Math.ceil(total / size) } })
}))
app.get('/api/transactions/:id', authMiddleware, wrap(async (req, res) => { const item = await Transaction.findOne({ _id: req.params.id, merchant: req.merchant._id }); if (!item) return fail(res, 404, 'Transaction not found'); return ok(res, item) }))

app.post('/api/group-splits', authMiddleware, wrap(async (req, res) => { const { total, participants, mode = 'CUSTOM' } = req.body || {}; let totalCents; try { totalCents = amountCents(total) } catch (error) { return fail(res, 400, error.message) } if (!Array.isArray(participants) || !participants.length) return fail(res, 400, 'Participants are required'); const shares = participants.map(item => ({ name: String(item.name || '').trim(), amountCents: amountCents(item.amount) })); if (shares.some(item => !item.name) || shares.reduce((sum, item) => sum + item.amountCents, 0) !== totalCents) return fail(res, 422, 'Participant shares must equal the total exactly'); const group = await GroupSplit.create({ merchant: req.merchant._id, totalCents, mode, participants: shares.map(item => ({ ...item, paymentReference: `GRP-${crypto.randomBytes(4).toString('hex').toUpperCase()}` })) }); return ok(res, group, 'Group split created') }))
app.get('/api/group-splits', authMiddleware, wrap(async (req, res) => ok(res, await GroupSplit.find({ merchant: req.merchant._id }).sort({ createdAt: -1 }))))
app.get('/api/group-splits/:id', authMiddleware, wrap(async (req, res) => { const group = await GroupSplit.findOne({ _id: req.params.id, merchant: req.merchant._id }); if (!group) return fail(res, 404, 'Group split not found'); return ok(res, group) }))
app.post('/api/group-splits/:id/participants/:participantId/pay', authMiddleware, wrap(async (req, res) => { const group = await GroupSplit.findOne({ _id: req.params.id, merchant: req.merchant._id }); const participant = group?.participants.id(req.params.participantId); if (!participant) return fail(res, 404, 'Participant not found'); if (participant.status === 'PAID') return fail(res, 409, 'Participant is already paid'); participant.status = 'PAID'; participant.paidAt = new Date(); await group.save(); return ok(res, group, 'Participant payment simulated') }))

app.get('/api/analytics/dashboard', authMiddleware, wrap(async (req, res) => { const { days = 30 } = req.query; const since = new Date(Date.now() - Number(days) * 86400000); const rows = await Transaction.find({ merchant: req.merchant._id, createdAt: { $gte: since } }); const sum = status => rows.filter(item => item.status === status).reduce((total, item) => total + item.amountCents, 0); return ok(res, { periodDays: Number(days), totalCollection: sum('SUCCESS') / 100, successfulTransactions: rows.filter(item => item.status === 'SUCCESS').length, pendingPayments: rows.filter(item => item.status === 'PENDING' || item.status === 'PROCESSING').length, failedPayments: rows.filter(item => item.status === 'FAILED').length, chart: rows.map(item => ({ date: item.createdAt, amount: item.amountCents / 100, status: item.status })) }) }))

app.get('/api/admin/merchants', authMiddleware, adminMiddleware, wrap(async (req, res) => { const { search, status } = req.query; const query = {}; if (status && status !== 'ALL') query.status = status; if (search) query.$or = [{ merchantId: new RegExp(String(search), 'i') }, { businessName: new RegExp(String(search), 'i') }, { upiId: new RegExp(String(search), 'i') }]; return ok(res, (await Merchant.find(query).sort({ createdAt: -1 })).map(publicMerchant)) }))
app.get('/api/admin/merchants/:id', authMiddleware, adminMiddleware, wrap(async (req, res) => { const merchant = await Merchant.findById(req.params.id); if (!merchant) return fail(res, 404, 'Merchant not found'); return ok(res, publicMerchant(merchant)) }))
app.patch('/api/admin/merchants/:id/status', authMiddleware, adminMiddleware, wrap(async (req, res) => { if (!['ACTIVE', 'INACTIVE'].includes(req.body?.status)) return fail(res, 422, 'Status must be ACTIVE or INACTIVE'); const merchant = await Merchant.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }); if (!merchant) return fail(res, 404, 'Merchant not found'); return ok(res, publicMerchant(merchant), 'Merchant status updated') }))

app.use((_, res) => fail(res, 404, 'Route not found'))
app.use((error, _, res, __) => { console.error('SplitPay request error:', error); if (error?.code === 11000) { const fields = Object.keys(error.keyPattern || {}); const duplicate = fields.includes('upiId') ? 'A merchant profile already exists for this UPI ID.' : fields.includes('email') ? 'Email already registered.' : 'A unique account value already exists.'; return fail(res, 409, duplicate, 'Duplicate account value') } if (error?.name === 'ValidationError') return fail(res, 422, 'Invalid registration details', 'Validation failed'); if (error?.name === 'CastError') return fail(res, 400, 'Invalid identifier'); if (error?.name === 'MongoServerSelectionError' || error?.name === 'MongoNetworkError') return fail(res, 503, 'Unable to connect to database', 'Database unavailable'); return fail(res, 500, 'Unexpected server error', process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message) })
export default app
