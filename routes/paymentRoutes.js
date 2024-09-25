import express  from "express";
import { debitAccount, deleteDebitTransaction, updateDebitTransaction } from "../functions/transaction.js";
import paymentCategoryModel from "../model/paymentCategoryModel.js";
import paymentModel from "../model/paymentModel.js";
import memberModel from "../model/memberModel.js";
import recieptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "../functions/recieptNumber.js";
const router=express.Router()


router.post('/createPayment/category', async (req, res) => {
   try {
    const { name, description} = req.body;
    if(name){
        const existingCategory = await paymentCategoryModel.findOne({ name });
        if(existingCategory){
            return res.status(400).json({
                success: false,
                message: 'Payment Category with the same name already exists.'
            });
        }
    }

    const category = new paymentCategoryModel({ name, description});
    await category.save();
    return res.status(201).json({
        success: true,
        message: 'Payment Category created successfully.',
        category
    });
   } catch (error) {
    return res.status(500).json({
        success: false,
        message: 'Failed to create payment category.',
        error: error.message
    });
   }
});

router.get('/category/all', async (req, res) => {
    try {
        const categories = await paymentCategoryModel.find({});
        return res.status(200).json({
            success: true,
            message: 'Payment Categories retrieved successfully.',
            categories
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment categories.',
            error: error.message
        });
    }
})
router.post('/create-payment', async (req, res) => {
    try {
        const { receiptNumber,items, date, accountId, categoryId, paymentType, memberId, otherRecipient } = req.body;

        // Calculate the total amount from the items array
        const total = items.reduce((acc, item) => acc + item.amount, 0);

        // Validate required fields
        if (total <= 0 || !accountId || !categoryId || !paymentType) {
            return res.status(400).json({ message: 'Items, accountId, categoryId, and paymentType are required.' });
        }

        // Validate that either memberId or otherRecipient is provided
        if (!memberId && (!otherRecipient || !otherRecipient.name)) {
            return res.status(400).json({ message: 'Either member or otherRecipient with a name is required.' });
        }

        // If memberId is provided, validate that the member exists
        if (memberId) {
            const memberExists = await memberModel.findById(memberId);
            if (!memberExists) {
                return res.status(404).json({ message: 'Member not found.' });
            }
        }
        if(receiptNumber){
            const checkRecieptNumber = await paymentModel.findOne({receiptNumber:receiptNumber});
            if (checkRecieptNumber) {
                    return res.status(400).json({ message: 'Reciept number already exists.' })
            }
        }

        // Create the payment
        const newPayment = new paymentModel({
            total,
            date: date || Date.now(),
            accountId,
            categoryId:categoryId._id,
            status:'Pending',
            paymentType,
            memberId: memberId || null,
            otherRecipient: memberId ? null : otherRecipient,
            items,
            receiptNumber
        })
        await newPayment.save();

        const category = categoryId.name;
        const des = `Payment for ${category} by ${paymentType}`;
        const transaction = await debitAccount(accountId, total, des, category);

        if (!transaction) {
            await Payment.findByIdAndDelete(newPayment._id);
            return res.status(500).json({ success: false, message: 'Error creating payment. Transaction failed.' });
        } else {
            newPayment.status = 'Completed';
            newPayment.transactionId = transaction._id
            await newPayment.save();
            const UptdateReceiptNumber = await recieptNumberModel.findOne();
            if (UptdateReceiptNumber) {
                UptdateReceiptNumber.paymentReceiptNumber.lastNumber = receiptNumber;
                await UptdateReceiptNumber.save();
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Payment created successfully.',
            payment: newPayment
        });

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            error,
            success: false,
            message: 'An error occurred while creating the payment.'
        });
    }
});

router.put('/edit-payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const updatedData = req.body;

        // Edit the payment
        const existingPayment = await paymentModel.findById(paymentId);
    if (!existingPayment) throw new Error('Payment not found');

    const { items, date, accountId, categoryId, paymentType, memberId, otherRecipient } = updatedData;
    const newTotal = items.reduce((acc, item) => acc + Number(item.amount||0), 0);
    if (newTotal <= 0) throw new Error('Invalid total amount');

    existingPayment.items = items;
    existingPayment.total = newTotal;
    existingPayment.date = date || Date.now();
    existingPayment.accountId = accountId;
    existingPayment.categoryId = categoryId._id;
    existingPayment.paymentType = paymentType;
    existingPayment.memberId = memberId || null;
    existingPayment.otherRecipient = memberId ? null : otherRecipient;


    // Save the updated payment

    const category = categoryId.name;
    const description = `Updated payment for ${category} by ${paymentType}`;
    await updateDebitTransaction(existingPayment.transactionId, newTotal, description, category);
if(!updateDebitTransaction){
    res.status(500).json({
        success: false,
        message: 'Error updating payment. Transaction failed.',
        error: updateDebitTransaction,
    });
}
await existingPayment.save();
        res.status(200).json({
            success: true,
            message: 'Payment and transaction updated successfully.',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating the payment.',
            error: error.message,
        });
    }
});
router.put('/reject-payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;

        // Edit the payment
        const existingPayment = await paymentModel.findById(paymentId);
    if (!existingPayment) throw new Error('Payment not found');


    existingPayment.status = 'Rejected';


    await deleteDebitTransaction(existingPayment.transactionId);
if(!deleteDebitTransaction){
    res.status(500).json({
        success: false,
        message: 'Error in rejecting. try later.',
        error: deleteDebitTransaction,
    });
}
await existingPayment.save();
        res.status(200).json({
            success: true,
            message: 'Payment and rejection updated successfully.',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating the payment.',
            error: error.message,
        });
    }
});

router.get('/get-payment/number', async (req, res) => {
    try {
        // Find the document that contains the payment receipt number.
        const receiptNumber = await recieptNumberModel.findOne();
        // If the document exists, return the last payment receipt number.
        if (receiptNumber && receiptNumber.paymentReceiptNumber) {
            const lastNumber = receiptNumber.paymentReceiptNumber.lastNumber
            const newNumber = await NextReceiptNumber(lastNumber)

            // Return the new payment receipt number
            return res.status(200).json({ success: true, paymentNumber: newNumber });
        } 
    } catch (error) {
       console.log(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


router.get('/get-payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await paymentModel.findById(paymentId).populate('categoryId memberId otherRecipient');
        if (!payment) throw new Error('Payment not found');
        res.status(200).json({ success: true, payment });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving the payment.',
            error: error.message,
        });
    }
});
router.get('/get/payments',async(req,res)=>{
    try {
        const payments = await paymentModel.find({}).sort({
            createdAt: -1,
        }).populate('categoryId memberId otherRecipient');
        res.status(200).json({ success: true, payments });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
})



export default router