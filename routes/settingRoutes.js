import express  from "express";
import recieptNumberModel from "../model/recieptNumberModel.js";
const router=express.Router()



router.get('/receiptNumbers', async (req, res) => {
    try {
        // Fetch all receipt numbers, only selecting the initialNumber fields
        const receiptNumbers = await recieptNumberModel.find({}, {
            'collectionReceiptNumber.initialNumber': 1,
            'paymentReceiptNumber.initialNumber': 1,
            'receiptReceiptNumber.initialNumber': 1,
        });

        // Respond with the receipt numbers
        res.status(200).json({success:true ,receiptNumbers});
    } catch (error) {
        // Handle errors
        res.status(500).json({ message: 'Error retrieving receipt numbers', error });
    }
});

router.put('/update-receipt-numbers', async (req, res) => {
    const { collectionReceiptNumber,paymentReceiptNumber,receiptReceiptNumber } = req.body;
   try{
   if (!collectionReceiptNumber || !paymentReceiptNumber|| !receiptReceiptNumber) {
    return res.status(400).json({ message: 'All initial numbers must be provided' });
}

// Update the receipt numbers in the database
const result = await recieptNumberModel.updateOne({}, {
    $set: {
        'collectionReceiptNumber.initialNumber': collectionReceiptNumber,
        'collectionReceiptNumber.lastNumber': collectionReceiptNumber,
        'paymentReceiptNumber.initialNumber': paymentReceiptNumber,
        'paymentReceiptNumber.lastNumber': paymentReceiptNumber,
        'receiptReceiptNumber.initialNumber': receiptReceiptNumber,
        'receiptReceiptNumber.lastNumber': receiptReceiptNumber,
    }
}, { upsert: true });

// Respond with success
res.status(200).json({success:true, message: 'Receipt numbers reset successfully', result });
} catch (error) {
console.log(error)
res.status(500).json({ success:false, message: 'Error resetting receipt numbers', error });
}

})


export default router