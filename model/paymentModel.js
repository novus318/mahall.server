import mongoose from "mongoose";

// Define the schema for a payment
const paymentSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true // Amount of the payment
    },
    date: {
        type: Date,
        default: Date.now // Date of the payment, default to current date
    },
    description: {
        type: String,
        required: false // Optional description for the payment
    },
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
        enum: ['Pending', 'Completed',],
        default: 'Pending',
        required: true
    },
    paymentType: {
        type: String,
        enum: ['Online', 'Cash'], // Type of payment: Online or Cash
        required: true // Payment type is required
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'member', // Reference to the member receiving the payment (if applicable)
        required: function() { return !this.otherRecipient; } 
    },
    otherRecipient: {
        name: {
            type: String,
            required: function() { return !this.memberId; } 
        },
    }
}, { timestamps: true });

// Export the model
export default mongoose.model('Payment', paymentSchema);
