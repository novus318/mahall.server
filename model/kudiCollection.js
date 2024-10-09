import mongoose from 'mongoose';

// Define the schema for a kudiCollection
const kudiCollectionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true // Amount of the kudiCollection
    },
    date: {
        type: Date,
        default: Date.now
    },
    PaymentDate: {
        type: Date,
    },
    description: {
        type: String,
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'bank',
    },
    category: {
        name: {
            type: String,
            required: true, // Name of the receipt category
        },
        description: {
            type: String,
            required: false // Optional description for the category
        }
    },
    kudiCollectionType: {
        type: String,
        enum: ['Online', 'Cash'], // Type of kudiCollection: Online or Cash
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'member',
        required: true
    },
    houseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'house',
        required: true
    },
    status:{
        type: String,
        enum: ['Paid', 'Unpaid', 'Rejected'],
        required: true
    },
    rejectionReason :{
        type: String,
    },
    receiptNumber: {
        type: String,
        unique: true 
    }
}, { timestamps: true }); 

// Export the model
export default mongoose.model('kudiCollection', kudiCollectionSchema);
