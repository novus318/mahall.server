import mongoose from "mongoose";

// Define the schema for a bank account
const bankSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true // Name of the bank or account
    },
    holderName: {
      type: String,
      required: true // Name of the account holder
    },
    accountNumber: {
      type: String,
      required: function() { return this.accountType === 'bank'; } // Required only if accountType is 'bank'
    },
    ifscCode: {
      type: String,
      required: function() { return this.accountType === 'bank'; } // Required only if accountType is 'bank'
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
