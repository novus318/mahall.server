import mongoose from "mongoose";

// Define the schema for a receipt category
const messageSchema = new mongoose.Schema({
    senderNumber: { type: String, required: true },
    messageContent: { type: String, required: true },
    messageType: { type: String, required: true }, // text, image, etc.
    time: { type: Date, default: Date.now }
},{ timestamps: true });

// Export the model
export default mongoose.model('message', messageSchema);
