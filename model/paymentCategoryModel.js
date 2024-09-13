import mongoose from "mongoose";


const paymentCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, 
        unique: true 
    },
    description: {
        type: String,
        required: false 
    }
}, { timestamps: true });


export default mongoose.model('paymentCategory', paymentCategorySchema);
