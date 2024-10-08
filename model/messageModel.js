import mongoose from "mongoose";

// Define the schema for a receipt category
const messageSchema = new mongoose.Schema({
    senderName: String,
    senderNumber: String,
    messageContent: String, 
    messageType: String,   
    mediaUrl: String,       
    mediaType: String,     
    emoji: String,        
    reactedToMessageId: String, 
    timestamp: String, 
    createdAt: {
        type: Date,
        default: Date.now
    }
});


// Export the model
export default mongoose.model('message', messageSchema);
