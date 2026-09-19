import mongoose from 'mongoose'

const { Schema } = mongoose
const statusValues = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'EXPIRED']

const merchantSchema = new Schema({
  merchantId: { type: String, unique: true, index: true, required: true },
  businessName: { type: String, required: true, trim: true, maxlength: 120 },
  ownerName: { type: String, trim: true, maxlength: 120 },
  upiId: { type: String, unique: true, required: true, lowercase: true, trim: true, index: true },
  email: { type: String, unique: true, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  profileImage: String,
  verificationStatus: { type: String, enum: ['verified', 'unverified'], default: 'unverified', index: true },
  verificationSource: { type: String, enum: ['demo-directory', 'authorized-provider', 'qr-input', 'unverified'], default: 'unverified' },
  verifiedAt: Date,
  role: { type: String, enum: ['merchant', 'admin'], default: 'merchant', index: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
}, { timestamps: true })

const userSchema = new Schema({ merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true }, role: { type: String, enum: ['merchant', 'admin'], default: 'merchant' }, lastLoginAt: Date }, { timestamps: true })
const qrTokenSchema = new Schema({ merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true }, tokenHash: { type: String, unique: true, required: true, index: true }, revokedAt: Date, expiresAt: Date }, { timestamps: true })

const trancheSchema = new Schema({
  reference: { type: String, unique: true, index: true }, amountCents: { type: Number, required: true, min: 1 }, status: { type: String, enum: statusValues, default: 'PENDING', index: true }, paymentIntent: String, processedAt: Date,
}, { _id: true, timestamps: true })
const paymentRequestSchema = new Schema({ merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true }, description: { type: String, trim: true, maxlength: 240 }, amountCents: { type: Number, required: true, min: 1 }, status: { type: String, enum: statusValues, default: 'PENDING', index: true }, tranches: [trancheSchema] }, { timestamps: true })
paymentRequestSchema.index({ merchant: 1, createdAt: -1 })

const transactionSchema = new Schema({ merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true }, paymentRequest: { type: Schema.Types.ObjectId, ref: 'PaymentRequest', required: true, index: true }, trancheId: { type: Schema.Types.ObjectId, required: true, index: true }, transactionId: { type: String, unique: true, index: true }, amountCents: { type: Number, required: true }, description: String, status: { type: String, enum: statusValues, required: true, index: true }, paymentReference: String, processedAt: Date }, { timestamps: true })
transactionSchema.index({ merchant: 1, createdAt: -1 })

const participantSchema = new Schema({ name: { type: String, required: true, trim: true, maxlength: 100 }, amountCents: { type: Number, required: true, min: 1 }, status: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' }, paymentReference: String, paidAt: Date }, { _id: true })
const groupSplitSchema = new Schema({ merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true }, totalCents: { type: Number, required: true, min: 1 }, mode: { type: String, enum: ['EQUAL', 'CUSTOM'], default: 'EQUAL' }, participants: [participantSchema] }, { timestamps: true })
const groupParticipantSchema = new Schema({ groupSplit: { type: Schema.Types.ObjectId, ref: 'GroupSplit', required: true, index: true }, name: String, amountCents: Number, status: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING' }, paymentReference: String }, { timestamps: true })

export const Merchant = mongoose.models.Merchant || mongoose.model('Merchant', merchantSchema)
export const User = mongoose.models.User || mongoose.model('User', userSchema)
export const QrToken = mongoose.models.QrToken || mongoose.model('QrToken', qrTokenSchema)
export const PaymentRequest = mongoose.models.PaymentRequest || mongoose.model('PaymentRequest', paymentRequestSchema)
export const PaymentTranche = mongoose.models.PaymentTranche || mongoose.model('PaymentTranche', trancheSchema)
export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema)
export const GroupSplit = mongoose.models.GroupSplit || mongoose.model('GroupSplit', groupSplitSchema)
export const GroupParticipant = mongoose.models.GroupParticipant || mongoose.model('GroupParticipant', groupParticipantSchema)

export const PAYMENT_STATUSES = statusValues
