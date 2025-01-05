import express  from "express";
import { debitAccount, deleteDebitTransaction, updateDebitTransaction } from "../functions/transaction.js";
import paymentCategoryModel from "../model/paymentCategoryModel.js";
import paymentModel from "../model/paymentModel.js";
import recieptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "../functions/recieptNumber.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
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
    logger.error(error)
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
        logger.error(error)
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment categories.',
            error: error.message
        });
    }
})
router.post('/create-payment', async (req, res) => {
        const { receiptNumber,items, date, accountId, categoryId, paymentType, paymentTo } = req.body;

        // Calculate the total amount from the items array
        const total = items.reduce((acc, item) => acc + item.amount, 0);

        // Validate required fields
        if (total <= 0 || !accountId || !categoryId || !paymentType) {
            return res.status(400).json({ message: 'Items, accountId, categoryId, and paymentType are required.' });
        }

        const session = await mongoose.startSession();;
        session.startTransaction();
    
        try {
            if (receiptNumber) {
                const checkReceiptNumber = await paymentModel.findOne({ receiptNumber });
                if (checkReceiptNumber) {
                    return res.status(400).json({ message: 'Receipt number already exists.' });
                }
            }
    
            // Create the payment document
            const newPayment = new paymentModel({
                total,
                date: date || Date.now(),
                accountId,
                categoryId: categoryId._id,
                status: 'Pending',
                paymentType,
                paymentTo,
                items,
                receiptNumber
            });
    
            await newPayment.save({ session });
    
            const category = categoryId.name;
            const description = `Payment for ${category} by ${paymentType}-${receiptNumber}`;
            const transaction = await debitAccount(accountId,total,description, category);
    
            if (!transaction) {
                throw new Error('Transaction failed.');
            }
    
            // Update the payment status to 'Completed'
            newPayment.status = 'Completed';
            newPayment.transactionId = transaction._id;
            await newPayment.save({ session });
    
            // Update the receipt number
            if (receiptNumber) {
                const updateReceiptNumber = await recieptNumberModel.findOne().session(session);
                if (updateReceiptNumber) {
                    updateReceiptNumber.paymentReceiptNumber.lastNumber = receiptNumber;
                    await updateReceiptNumber.save({ session });
                }
            }
    
            // Commit the transaction
            await session.commitTransaction();
            session.endSession();
    
            return res.status(201).json({
                success: true,
                message: 'Payment created successfully.',
                payment: newPayment
            });
    
        } catch (error) {
            logger.error(error)
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({
                success: false,
                message: 'An error occurred while creating the payment.',
                error: error.message
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

    const { items, date, accountId, categoryId, paymentType,paymentTo } = updatedData;
    const newTotal = items.reduce((acc, item) => acc + Number(item.amount||0), 0);
    if (newTotal <= 0) throw new Error('Invalid total amount');

    existingPayment.items = items;
    existingPayment.total = newTotal;
    existingPayment.date = date || Date.now();
    existingPayment.accountId = accountId;
    existingPayment.categoryId = categoryId._id;
    existingPayment.paymentType = paymentType;
    existingPayment.paymentTo = paymentTo


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
        logger.error(error)
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
        const { rejectionReason } = req.body;

        // Validate rejection reason
        if (!rejectionReason || typeof rejectionReason !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required and must be a string.',
            });
        }

        // Find payment by ID
        const existingPayment = await paymentModel.findById(paymentId);
        if (!existingPayment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found.',
            });
        }

        // Update payment status and reason
        existingPayment.status = 'Rejected';
        existingPayment.rejectionReason = rejectionReason;

        // Delete the associated debit transaction
        const deleteResult = await deleteDebitTransaction(existingPayment.transactionId);
        if (!deleteResult) {
            return res.status(500).json({
                success: false,
                message: 'Error in rejecting payment. Please try again later.',
            });
        }

        // Save the updated payment
        await existingPayment.save();

        // Respond with success
        res.status(200).json({
            success: true,
            message: 'Payment rejection updated successfully.',
        });
    } catch (error) {
        logger.error(error)
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
        logger.error(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


router.get('/get-payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await paymentModel.findById(paymentId).populate('categoryId');
        if (!payment) throw new Error('Payment not found');
        res.status(200).json({ success: true, payment });
    } catch (error) {
        logger.error(error)
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
        }).populate('categoryId');
        res.status(200).json({ success: true, payments });
    } catch (error) {
        logger.error(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
})



export default router