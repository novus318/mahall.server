import mongoose from 'mongoose';

// Define the schema for a receipt
const receiptSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true // Amount of the receipt
    },
    date: {
        type: Date,
        default: Date.now // Date of the receipt, default to current date
    },
    description: {
        type: String,
        required: false // Optional description for the receipt
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'bank', // Reference to the bank account where the receipt is recorded
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'receiptCategory', 
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed',],
        default: 'Pending',
        required: true
    },
    recieptType: {
        type: String,
        enum: ['Online', 'Cash'], // Type of receipt: Online or Cash
        required: true // Receipt type is required
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member', // Reference to the member associated with the receipt (if applicable)
        required: function() { return !this.otherRecipient; } // Required if otherRecipient is not provided
    },
    otherRecipient: {
        name: {
            type: String,
            required: function() { return !this.memberId; } // Required if memberId is not provided
        },
        number: {
            type: String,
            required: function() { return !this.memberId; } // Required if memberId is not provided
        }
    },
    receiptNumber: {
        type: String,
        unique: true // Ensure receipt number is unique
    }
}, { timestamps: true }); // Timestamps for createdAt and updatedAt

receiptSchema.pre('save', async function (next) {
    if (this.isNew) {
        // Find the latest receiptNumber in the collection
        const latestEntry = await mongoose.model('Receipt').findOne({}, { receiptNumber: 1 })
            .sort({ createdAt: -1 });

        let newReceiptNumber = 'RA-0001';
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
export default mongoose.model('Receipt', receiptSchema);
