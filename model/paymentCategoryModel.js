import mongoose from "mongoose";

// Define the schema for a payment category
const paymentCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, // Name of the payment category
        unique: true // Category names should be unique
    },
    description: {
        type: String,
        required: false // Optional description for the category
    }
}, { timestamps: true }); // Timestamps for createdAt and updatedAt

// Export the model
export default mongoose.model('paymentCategory', paymentCategorySchema);
