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
        required: false
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'bank', // Reference to the bank account where the kudiCollection is recorded
        required: true
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
    receiptNumber: {
        type: String,
        unique: true // Ensure receipt number is unique
    }
}, { timestamps: true }); // Timestamps for createdAt and updatedAt

kudiCollectionSchema.pre('save', async function (next) {
    if (this.isNew) {
        // Find the latest receiptNumber in the collection
        const latestEntry = await mongoose.model('kudiCollection').findOne({}, { receiptNumber: 1 })
            .sort({ createdAt: -1 });

        let newReceiptNumber = 'KA-0001';
        if (latestEntry && latestEntry.receiptNumber) {
            const [prefix, numberPart] = latestEntry.receiptNumber.split('-');
            let lastNumber = parseInt(numberPart, 10);

            // Increment the number part
            if (lastNumber < 9999) {
                newReceiptNumber = `${prefix}-${(lastNumber + 1).toString().padStart(4, '0')}`;
            } else {
                // Change the prefix if the number part has reached 9999
                const newPrefix = String.fromCharCode(prefix.charCodeAt(1) + 1);
                newReceiptNumber = `${prefix[0]}${newPrefix}-0001`;
            }
        }

        this.receiptNumber = newReceiptNumber;
    }
    next();
});

// Export the model
export default mongoose.model('kudiCollection', kudiCollectionSchema);
