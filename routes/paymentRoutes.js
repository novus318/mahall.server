import express  from "express";
import { debitAccount } from "../functions/transaction.js";
import paymentCategoryModel from "../model/paymentCategoryModel.js";
import paymentModel from "../model/paymentModel.js";
import memberModel from "../model/memberModel.js";
const router=express.Router()


router.post('/createPayment/category', async (req, res) => {
   try {
    const { name, description} = req.body;
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
        const { items, date, accountId, categoryId, paymentType, memberId, otherRecipient } = req.body;

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
            items // Include the items array
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




export default router