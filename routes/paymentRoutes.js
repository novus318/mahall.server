import express  from "express";
import { debitAccount } from "../functions/transaction.js";
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