import mongoose from "mongoose";

// Define the schema for receipt numbers
const receiptNumberSchema = new mongoose.Schema({
    collectionReceiptNumber: {
        initialNumber: {
            type: String,
            required: true,
        },
        lastNumber: {
            type: String,
            required: true,
        },
    },
    paymentReceiptNumber: {
        initialNumber: {
            type: String,
            required: true,
        },
        lastNumber: {
            type: String,
            required: true,
        },
    },
    receiptReceiptNumber: {
        initialNumber: {
            type: String,
            required: true,
        },
        lastNumber: {
            type: String,
            required: true,
        },
    },
}, { timestamps: true }); 

// Export the model
export default mongoose.model('ReceiptNumber', receiptNumberSchema);
