import express  from "express";
import recieptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "../functions/recieptNumber.js";
const router=express.Router()




router.put('/update-collectionReceiptNumber', async (req, res) => {
    const { collectionReceiptNumber } = req.body;
   try{
   if (!collectionReceiptNumber) {
    return res.status(400).json({ message: 'Collection reciept number should be provided' });
}

// Update the receipt numbers in the database
const result = await recieptNumberModel.updateOne({}, {
    $set: {
        'collectionReceiptNumber.initialNumber': collectionReceiptNumber,
        'collectionReceiptNumber.lastNumber': collectionReceiptNumber,
    }
}, { upsert: true });

// Respond with success
res.status(200).json({success:true, message: 'Receipt number reset successfully', result });
} catch (error) {
console.log(error)
res.status(500).json({ success:false, message: 'Error resetting receipt numbers', error });
}
})

router.put('/update-paymentReceiptNumber', async (req, res) => {
    const { paymentReceiptNumber } = req.body;
   try{
   if (!paymentReceiptNumber) {
    return res.status(400).json({ message: 'Payment reciept number should be provided' });
}

// Update the receipt numbers in the database
const result = await recieptNumberModel.updateOne({}, {
    $set: {
        'paymentReceiptNumber.initialNumber': paymentReceiptNumber,
        'paymentReceiptNumber.lastNumber': paymentReceiptNumber,
    }
}, { upsert: true });

// Respond with success
res.status(200).json({success:true, message: 'Receipt number reset successfully', result });
} catch (error) {
console.log(error)
res.status(500).json({ success:false, message: 'Error resetting receipt numbers', error });
}
})

router.put('/update-receiptReceiptNumber', async (req, res) => {
    const { receiptReceiptNumber } = req.body;
   try{
   if (!receiptReceiptNumber) {
    return res.status(400).json({ message: 'Reciept number should be provided' });
}

// Update the receipt numbers in the database
const result = await recieptNumberModel.updateOne({}, {
    $set: {
        'receiptReceiptNumber.initialNumber': receiptReceiptNumber,
        'receiptReceiptNumber.lastNumber': receiptReceiptNumber,
    }
}, { upsert: true });

// Respond with success
res.status(200).json({success:true, message: 'Receipt number reset successfully', result });
} catch (error) {
console.log(error)
res.status(500).json({ success:false, message: 'Error resetting receipt numbers', error });
}
})

router.get('/get-collection/number', async (req, res) => {
    try {
       
        const receiptNumber = await recieptNumberModel.findOne();
       
        if (receiptNumber && receiptNumber.collectionReceiptNumber) {
            const lastNumber = receiptNumber.collectionReceiptNumber.lastNumber
            const newNumber = await NextReceiptNumber(lastNumber)

            return res.status(200).json({ success: true, Number: newNumber });
        } 
    } catch (error) {
       console.log(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


export default router