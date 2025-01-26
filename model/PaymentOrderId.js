import mongoose from "mongoose";


const PaymentSchema = new mongoose.Schema(
    {
        order_id: {
            type: String,
            required: true,
            unique: true,
        },
        receipt: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['created', 'captured', 'failed'],
            default: 'created',
        },
    },
    {
        timestamps: true,
    }
);

// Export the model
export default mongoose.model('PaymentOrderId', PaymentSchema);
