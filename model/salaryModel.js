import mongoose from "mongoose";

const deductionSchema = new mongoose.Schema({
  name: { type: String, required: true }, 
  amount: { type: Number, required: true }
});

const salarySchema = new mongoose.Schema({
staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'staff', required: true },
  basicPay: { type: Number, required: true }, 
  advancePay: { type: Number, default: 0 },
  deductions: [deductionSchema], 
  netPay: { type: Number, required: true }, 
  salaryPeriod: {
    startDate: { type: Date, required: true }, 
    endDate: { type: Date, required: true } 
  },
  paymentDate: { type: Date },
  status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' }, // Payment status
}, 
{ timestamps: true }); // To track creation and update times

export default mongoose.model('salary', salarySchema);
