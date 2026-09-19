import 'dotenv/config'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { connectDatabase, disconnectDatabase } from './config/db.js'
import { Merchant, User, QrToken, PaymentRequest, Transaction, GroupSplit } from './models/models.js'

const cents = value => Math.round(value * 100)
const merchantId = 'MCH-TYB-8F42K7'

await connectDatabase()
await Promise.all([Merchant.deleteMany({ merchantId }), PaymentRequest.deleteMany({ description: /^Demo/ }), GroupSplit.deleteMany({ mode: 'EQUAL' })])
const merchant = await Merchant.create({ merchantId, businessName: 'Tayyeeb Services', ownerName: 'Tayyeeb Shaikh', upiId: 'tayyeeb.demo@upi', email: 'demo@splitpay.local', phone: '+91 90000 00000', passwordHash: await bcrypt.hash('demo1234', 12), role: 'merchant', status: 'ACTIVE' })
await User.create({ merchant: merchant._id, role: merchant.role })
await QrToken.create({ merchant: merchant._id, tokenHash: crypto.createHash('sha256').update('demo-profile-token').digest('hex') })
const statuses = ['SUCCESS', 'SUCCESS', 'SUCCESS', 'PENDING', 'FAILED', 'SUCCESS', 'PENDING']
for (let index = 0; index < statuses.length; index += 1) {
  const amount = [1250, 1999, 850, 6800, 999, 4500, 3200][index]
  const status = statuses[index]
  const reference = `SEED-${index + 1}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  const request = await PaymentRequest.create({ merchant: merchant._id, description: `Demo collection ${index + 1}`, amountCents: cents(amount), status, tranches: [{ amountCents: cents(amount), status, reference, paymentIntent: `upi://pay?pa=${merchant.upiId}&pn=Tayyeeb%20Services&am=${amount.toFixed(2)}&cu=INR&tn=${reference}`, processedAt: status === 'PENDING' ? undefined : new Date() }] })
  await Transaction.create({ merchant: merchant._id, paymentRequest: request._id, trancheId: request.tranches[0]._id, transactionId: `TXN-SEED-${index + 1}`, amountCents: cents(amount), description: request.description, status, paymentReference: reference, processedAt: status === 'PENDING' ? undefined : new Date() })
}
await GroupSplit.create({ merchant: merchant._id, totalCents: cents(6800), mode: 'EQUAL', participants: [1700, 1700, 1700, 1700].map((amount, index) => ({ name: ['You', 'Rohit', 'Aman', 'Rahul'][index], amountCents: cents(amount), paymentReference: `GRP-SEED-${index + 1}` })) })
console.log('Seeded demo merchant: demo@splitpay.local / demo1234')
await disconnectDatabase()
