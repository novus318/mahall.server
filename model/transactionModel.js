import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    type: { type: String, enum: ['Credit', 'Debit'], required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now }, 
    description: String,
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'bank', required: true },
    category: String, 
    openingBalance: { type: Number, required: true },
    closingBalance: { type: Number, required: true },
    reference:{ type:String}
  },
  { timestamps: true });

export default mongoose.model('transaction', transactionSchema);
