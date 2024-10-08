import mongoose from "mongoose";

// Define the schema for a receipt category
const messageSchema = new mongoose.Schema({
    senderName: String,
    senderNumber: String,
    messageContent: String,
    messageType: String,   
    mediaBlob: Buffer,     
    mediaType: String,  
    emoji: String,       
    reactedToMessageId: String, 
    time: { type: Date, default: Date.now }
},{ timestamps: true });

// Export the model
export default mongoose.model('message', messageSchema);
