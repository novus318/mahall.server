import mongoose from "mongoose";

// Define the schema for a payment
const paymentSchema = new mongoose.Schema({
    total: {
        type: Number,
        required: true // Total amount of the payment
    },
    date: {
        type: Date,
        default: Date.now // Date of the payment, default to current date
    },
    items: [{
        description: {
            type: String,
            required: true // Description of the item
        },
        amount: {
            type: Number,
            required: true // Amount for the item
        }
    }],
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'bank', // Reference to the bank account where the payment is made
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'paymentCategory', // Reference to the payment category
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed',],
        default: 'Pending',
        required: true
    },
    paymentType: {
        type: String,
        enum: ['Online', 'Cash'], // Type of payment: Online or Cash
        required: true // Payment type is required
    },
    memberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'member', // Reference to the member receiving the payment (if applicable)
        required: function() { return !this.otherRecipient; } 
    },
    otherRecipient: {
        name: {
            type: String,
            required: function() { return !this.memberId; } 
        },
        number: {
            type: String,
            required: function() { return !this.memberId; } 
        }
    },
    receiptNumber: {
        type: String,
        unique: true // Ensure receipt number is unique
    }
}, { timestamps: true });

paymentSchema.pre('save', async function (next) {
    if (this.isNew) {
        // Find the latest receiptNumber in the collection
        const latestEntry = await mongoose.model('Payment').findOne({}, { receiptNumber: 1 })
            .sort({ createdAt: -1 });

        let newReceiptNumber = 'PA-0001';
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
export default mongoose.model('Payment', paymentSchema);
