import express from "express"
import kudiCollection from "../model/kudiCollection.js";
import Razorpay from 'razorpay';
import dotenv from 'dotenv'
import crypto from 'crypto';
import mongoose from "mongoose";
import { creditAccount } from "../functions/transaction.js";
import { sendWhatsAppMessageFunction } from "../functions/generateMonthlyCollections.js";
import BankModel from "../model/BankModel.js";

dotenv.config({ path: './.env' })

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET =process.env.RAZORPAY_KEY_SECRET
const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
});

const router = express.Router()


router.post('/create-order',async (req, res) => {
    try {
        const { amount, receipt } = req.body;
        const options = {
            amount, // Amount in paisa
            currency: 'INR',
            receipt,
        };
        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: 'Unable to create Razorpay order.', error });
    }
})


router.post('/verify-payment', async (req, res) => {
    const session = await mongoose.startSession();
    try {
        // Validate request body
        const { order_id, payment_id, signature, recieptNumber } = req.body;
        if (!order_id ||!payment_id ||!signature ||!recieptNumber) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Find primary account
        const targetAccount = await BankModel.findOne({ primary: true }).lean();
        if (!targetAccount) {
            return res.status(404).json({ success: false, message: 'Primary account not found' });
        }

        // Verify Razorpay signature
        const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(`${order_id}|${payment_id}`)
            .digest('hex');
        if (generatedSignature !== signature) {
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        session.startTransaction();

        // Update kudi collection
        const updatedCollection = await kudiCollection
            .findOneAndUpdate(
                { receiptNumber: recieptNumber },
                {
                    kudiCollectionType: 'Online',
                    accountId: targetAccount._id,
                    status: 'Paid',
                    PaymentDate: new Date(),
                },
                { new: true, session }
            )
            .populate('memberId houseId')
            .lean();

        if (!updatedCollection) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Kudi collection not found' });
        }

        // Credit account
        const ref = `/house/house-details/${updatedCollection.houseId._id}`;
        const transaction = await creditAccount(
            targetAccount._id,
            updatedCollection.amount,
            updatedCollection.description,
            updatedCollection.category.name,
            ref,
            session
        );

        if (!transaction) {
            // Rollback on failure
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Error crediting account' });
        }

        // Send WhatsApp notification
        await sendWhatsAppMessageFunction(updatedCollection);

        await session.commitTransaction();
        res.status(200).json({ success: true, message: 'Payment verified and processed successfully',
            updatedCollection
         });
    } catch (error) {
        console.error('Error in payment verification:', error);
        await session.abortTransaction();
        res.status(500).json({ success: false, message: 'Payment verification failed', error: error.message });
    } finally {
        session.endSession();
    }
});


router.get('/house-collection/:recieptNo', async (req, res) => {
    const { recieptNo } = req.params;
    console.log(recieptNo)
    try {
        if (recieptNo) {
            const houseCollection = await kudiCollection.findOne({ receiptNumber : recieptNo }).sort({ createdAt: -1 }).limit(10)
            .populate('memberId')
            .populate('houseId');
            if (!houseCollection) {
                return res.status(404).send({ success: false, message: 'House collection not found' });
            }

            return res.status(200).json({ success: true, houseCollection });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).send({ success: false, message: 'Server error' });
    }
});

export default router;
