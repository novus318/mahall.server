import mongoose from 'mongoose';

// Define the schema for a receipt
const receiptSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true // Amount of the receipt
    },
    date: {
        type: Date,
        default: Date.now // Date of the receipt, default to current date
    },
    description: {
        type: String,
        required: false // Optional description for the receipt
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'bank', // Reference to the bank account where the receipt is recorded
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'receiptCategory', 
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed','Rejected',],
        default: 'Pending',
        required: true
    },
    recieptType: {
        type: String,
        enum: ['Online', 'Cash'], // Type of receipt: Online or Cash
        required: true // Receipt type is required
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'member', // Reference to the member associated with the receipt (if applicable)
        required: function() { return !this.otherRecipient; } // Required if otherRecipient is not provided
    },
    otherRecipient: {
        name: {
            type: String,
            required: function() { return !this.memberId; } // Required if memberId is not provided
        },
        number: {
            type: String,
            required: function() { return !this.memberId; } // Required if memberId is not provided
        }
    },
    transactionId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'transaction',
},
    receiptNumber: {
        type: String,
        unique: true // Ensure receipt number is unique
    }
}, { timestamps: true }); // Timestamps for createdAt and updatedAt


// Export the model
export default mongoose.model('Receipt', receiptSchema);
