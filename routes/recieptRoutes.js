import express  from "express";
import memberModel from "../model/memberModel.js";
import recieptCategoryModel from "../model/recieptCategoryModel.js";
import recieptModel from "../model/recieptModel.js";
import { creditAccount, deleteCreditTransaction, updateCreditTransaction } from "../functions/transaction.js";
import recieptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "../functions/recieptNumber.js";
import { sendReceiptNotification } from "../functions/receiptTemplate.js";
import logger from "../utils/logger.js";
const router=express.Router()


router.post('/createReciept/category', async (req, res) => {
   try {
    const { name, description} = req.body;
    if(name){
        const existingCategory = await recieptCategoryModel.findOne({ name });
        if(existingCategory){
            return res.status(400).json({
                success: false,
                message: 'Reciept Category with the same name already exists.'
            });
        }
    }
    const category = new recieptCategoryModel({ name, description});
    await category.save();
    return res.status(201).json({
        success: true,
        message: 'Reciept Category created successfully.',
        category
    });
   } catch (error) {
    logger.error(error)
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
        logger.error(error)
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
        const recieptDescription =`Receipt for ${category} by ${recieptType}-${receiptNumber}`
        const transaction = await creditAccount(accountId, amount, recieptDescription, category);

        if (!transaction) {
            await recieptModel.findByIdAndDelete(newReciept._id);
            return res.status(500).json({ success: false, message: 'Error creating payment. Transaction failed.' });
        } else {
            newReciept.status = 'Completed';
            newReciept.transactionId = transaction._id;
            await newReciept.save();
            const UptdateReceiptNumber = await recieptNumberModel.findOne();
            if (UptdateReceiptNumber) {
                UptdateReceiptNumber.receiptReceiptNumber.lastNumber = receiptNumber;
                await UptdateReceiptNumber.save();
            }

            // Send WhatsApp notification
            try {
                await sendReceiptNotification(newReciept);
            } catch (notificationError) {
                logger.error('Failed to send WhatsApp notification:', notificationError);
                // Don't fail the entire request if notification fails
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Reciept created successfully.',
            payment: newReciept
        });

    } catch (error) {
        logger.error(error)
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
        logger.error(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/get-reciept/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const reciept = await recieptModel.findById(id).populate('categoryId memberId otherRecipient');
        if (!reciept) return res.status(404).json({ success: false, message: 'Reciept not found.' });
        res.status(200).json({ success: true, reciept });
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
        logger.error(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
})

router.put('/update-reciept/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        const reciept = await recieptModel.findById(id);
        if (!reciept) return res.status(404).json({ success: false, message: 'Reciept not found.' });
        const { amount, date,description, accountId, categoryId, recieptType, memberId, otherRecipient } = updatedData;
      
        reciept.amount = amount,
        reciept.date = date || Date.now(),
        reciept.description = description,
        reciept.accountId = accountId,
        reciept.categoryId = categoryId._id,
        reciept.recieptType = recieptType,
        reciept.memberId = memberId || null,
        reciept.otherRecipient = memberId? null : otherRecipient

        const category = categoryId.name;
        await updateCreditTransaction(reciept.transactionId,amount,description,category)
        if(!updateCreditTransaction){
            res.status(500).json({
                success: false,
                message: 'Error updating payment. Transaction failed.',
                error: updateCreditTransaction,
            });
        }
        await reciept.save();
        res.status(200).json({ success: true, message: 'Reciept updated successfully.', reciept });
    } catch (error) {
        logger.error(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


router.put('/reject-reciept/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        // Validate rejection reason
        if (!rejectionReason || typeof rejectionReason !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required and must be a string.',
            });
        }

        // Find receipt by ID
        const reciept = await recieptModel.findById(id);
        if (!reciept) {
            return res.status(404).json({
                success: false,
                message: 'Receipt not found.',
            });
        }

        // Update receipt status and reason
        reciept.status = 'Rejected';
        reciept.rejectionReason = rejectionReason;

        // Delete the associated credit transaction
        const deleteResult = await deleteCreditTransaction(reciept.transactionId);
        if (!deleteResult) {
            return res.status(500).json({
                success: false,
                message: 'Error in rejecting. Please try again later.',
            });
        }

        // Save updated receipt
        await reciept.save();

        // Respond with success
        res.status(200).json({
            success: true,
            message: 'Receipt rejected successfully.',
        });
    } catch (error) {
        logger.error(error)
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
            error: error.message,
        });
    }
});

export default router