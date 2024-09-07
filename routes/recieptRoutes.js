import express  from "express";
import memberModel from "../model/memberModel.js";
import recieptCategoryModel from "../model/recieptCategoryModel.js";
import recieptModel from "../model/recieptModel.js";
import { creditAccount } from "../functions/transaction.js";
import recieptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "../functions/recieptNumber.js";
const router=express.Router()


router.post('/createReciept/category', async (req, res) => {
   try {
    const { name, description} = req.body;
    const category = new recieptCategoryModel({ name, description});
    await category.save();
    return res.status(201).json({
        success: true,
        message: 'Reciept Category created successfully.',
        category
    });
   } catch (error) {
    return res.status(500).json({
        success: false,
        message: 'Failed to create reciept category.',
        error: error.message
    });
   }
});

router.get('/category/all', async (req, res) => {
    try {
        const categories = await recieptCategoryModel.find({});
        return res.status(200).json({
            success: true,
            message: 'Reciept Categories retrieved successfully.',
            categories
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve reciept categories.',
            error: error.message
        });
    }
})
router.post('/create-reciept', async (req, res) => {
    try {
        const { receiptNumber, amount, date,description, accountId, categoryId, recieptType, memberId, otherRecipient } = req.body;


        // Validate required fields
        if (amount <= 0 || !accountId || !categoryId || !recieptType) {
            return res.status(400).json({ message: 'Items, accountId, categoryId, and reciept type are required.' });
        }

        // Validate that either memberId or otherRecipient is provided
        if (!memberId && (!otherRecipient || !otherRecipient.name)) {
            return res.status(400).json({ message: 'Either member or otherRecipient with a name is required.' });
        }

        if(!memberId && !otherRecipient.number)
        // If memberId is provided, validate that the member exists
        if (memberId) {
            const memberExists = await memberModel.findById(memberId);
            if (!memberExists) {
                return res.status(404).json({ message: 'Member not found.' });
            }
        }

        if(receiptNumber){
            const checkRecieptNumber = await recieptModel.findOne({receiptNumber:receiptNumber});
            if (checkRecieptNumber) {
                    return res.status(400).json({ message: 'Reciept number already exists.' })
            }
        }
        // Create the payment
        const newReciept = new recieptModel({
            amount,
            date: date || Date.now(),
            description,
            accountId,
            categoryId:categoryId._id,
            status:'Pending',
            recieptType:recieptType,
            memberId: memberId || null,
            otherRecipient: memberId ? null : otherRecipient,
            receiptNumber
        })
        await newReciept.save();

        const category = categoryId.name;
        const transaction = await creditAccount(accountId, amount, description, category);

        if (!transaction) {
            await Payment.findByIdAndDelete(newReciept._id);
            return res.status(500).json({ success: false, message: 'Error creating payment. Transaction failed.' });
        } else {
            newReciept.status = 'Completed';
            await newReciept.save();
            const UptdateReceiptNumber = await recieptNumberModel.findOne();
            if (UptdateReceiptNumber) {
                UptdateReceiptNumber.receiptReceiptNumber.lastNumber = receiptNumber;
                await UptdateReceiptNumber.save();
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Reciept created successfully.',
            payment: newReciept
        });

    } catch (error) {
        console.log(error)
        return res.status(500).json({
            error,
            success: false,
            message: 'An error occurred while creating the reciept.'
        });
    }
});

router.get('/get-reciept/number', async (req, res) => {
    try {
       
        const receiptNumber = await recieptNumberModel.findOne();
       
        if (receiptNumber && receiptNumber.receiptReceiptNumber) {
            const lastNumber = receiptNumber.receiptReceiptNumber.lastNumber
            const newNumber = await NextReceiptNumber(lastNumber)

            return res.status(200).json({ success: true, Number: newNumber });
        } 
    } catch (error) {
       console.log(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


router.get('/get-reciepts', async (req, res) => {
    try {
        const reciepts = await recieptModel.find({}).sort({
            createdAt: -1,
        }).populate('categoryId memberId otherRecipient');
        res.status(200).json({ success: true, reciepts });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
})



export default router