import mongoose from "mongoose";

// Define the schema for a receipt category
const houseTypeLockSchema = new mongoose.Schema({
    isEnabled: {
        type: Boolean,
        default: false
    },
},{ timestamps: true });

// Export the model
export default mongoose.model('houseLock', houseTypeLockSchema);
