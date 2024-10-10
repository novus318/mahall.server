import mongoose from "mongoose";

// Define the schema for a payment
const paymentSchema = new mongoose.Schema({
    total: {
        type: Number,
        required: true // Total amount of the payment
    },
    date: {
        type: Date,
        default: Date.now // Date of the payment, default to current date
    },
    items: [{
        description: {
            type: String,
            required: true // Description of the item
        },
        amount: {
            type: Number,
            required: true // Amount for the item
        }
    }],
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'bank', // Reference to the bank account where the payment is made
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'paymentCategory', // Reference to the payment category
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed','Rejected',],
        default: 'Pending',
        required: true
    },
    paymentType: {
        type: String,
        enum: ['Online', 'Cash'], // Type of payment: Online or Cash
        required: true // Payment type is required
    },
    transactionId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'transaction', // Reference to the transaction associated with the payment (if applicable)
},
    paymentTo: {
        type: String,
    },
    receiptNumber: {
        type: String,
        unique: true // Ensure receipt number is unique
    }
}, { timestamps: true });


// Export the model
export default mongoose.model('Payment', paymentSchema);
