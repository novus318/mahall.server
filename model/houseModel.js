import mongoose from "mongoose";

const houseSchema = new mongoose.Schema({
   name: String,
   address: String,
   number: {
      type: String,
      unique: true 
   },
   panchayathNumber: {
      type: String,
   },
   wardNumber: {
      type: String,
   },
   familyHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'member'
   },
   collectionAmount: {
      type: Number,
      default: 0
   },
   lastCollection: {
      type: Date,
   },
   status: {
      type: String,
      enum: ['rented', 'owned'], 
      required: true 
   },
   paidMonths: {
      type: [String],
      default: [],
   },
   paidYears: {
      type: [String],
      default: [],
   },
   paymentType: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
   },
   rationsStatus: String,
}, { timestamps: true });

export default mongoose.model('house', houseSchema);