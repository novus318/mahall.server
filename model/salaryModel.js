import mongoose from "mongoose";

const salarySchema = new mongoose.Schema({
staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'staff', required: true },
  basicPay: { type: Number, required: true }, 
  advanceDeduction: { type: Number, default: 0 },
  onleave:{
    days: { type: Number },
    deductAmount: { type: Number } 
  },
  netPay: { type: Number }, 
  salaryPeriod: {
    startDate: { type: Date, required: true }, 
    endDate: { type: Date, required: true } 
  },
  paymentDate: { type: Date },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'bank',
},
  status: { type: String, enum: ['Pending', 'Paid','Rejected'], default: 'Pending' },
  rejectionReason :{ type: String },
}, 
{ timestamps: true }); // To track creation and update times

export default mongoose.model('salary', salarySchema);
