import mongoose from "mongoose";

// Define the schema for a bank account
const bankSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    holderName: {
      type: String,
      required: true 
    },
    accountNumber: {
      type: String,
      required: function() { return this.accountType === 'bank'; } 
    },
    ifscCode: {
      type: String,
      required: function() { return this.accountType === 'bank'; } 
    },
    balance: {
      type: Number,
      default: 0 // Default balance is 0
    },
    accountType: {
      type: String,
      enum: ['bank', 'cash'], // Possible values: 'bank' or 'cash'
      required: true // Account type is required
    },
    primary: {
      type: Boolean,
      default: false, // Default is not primary
    },
}, { timestamps: true }); // Timestamps for createdAt and updatedAt

// Export the model
export default mongoose.model('bank', bankSchema);
