import express from "express"
import kudiCollection from "../model/kudiCollection.js";
import Razorpay from 'razorpay';
import dotenv from 'dotenv'
import crypto from 'crypto';
import mongoose from "mongoose";
import { creditAccount } from "../functions/transaction.js";
import { sendWhatsAppMessageFunction } from "../functions/generateMonthlyCollections.js";
import BankModel from "../model/BankModel.js";
import logger from "../utils/logger.js";
import { sendWhatsAppPartial, sendWhatsAppYearlyReceipt } from "../functions/generateYearlyCollection.js";


dotenv.config({ path: './.env' })

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const router = express.Router()


const updateReceiptAndAmount = async (props) => {
    const { receiptNumber, amount } = props;
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      // Find collection by receipt number
      const existingCollection = await kudiCollection.findOne({ receiptNumber })
        .populate('memberId houseId')
        .session(session);
  
      if (!existingCollection) {
        await session.abortTransaction();
        session.endSession();
        return false; // Return false if collection not found
      }
  
      // Validate payment amount
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        await session.abortTransaction();
        session.endSession();
        return false; // Return false if amount is invalid
      }
  
      const isYearlyPayment = existingCollection.paymentType === 'yearly';
  
      // Validate monthly payment amount
      if (!isYearlyPayment && numericAmount !== existingCollection.amount) {
        await session.abortTransaction();
        session.endSession();
        return false; // Return false if monthly payment amount is incorrect
      }
  
      // Validate yearly payment limits
      if (isYearlyPayment) {
        const newPaidAmount = existingCollection.paidAmount + numericAmount;
        if (newPaidAmount > existingCollection.totalAmount) {
          await session.abortTransaction();
          session.endSession();
          return false; // Return false if payment exceeds total amount due
        }
  
        existingCollection.paidAmount = newPaidAmount;
        existingCollection.status = newPaidAmount >= existingCollection.totalAmount ? 'Paid' : 'Partial';
        existingCollection.partialPayment = true;
  
        // Add partial payment details for yearly payments
        existingCollection.partialPayments.push({
          amount: numericAmount,
          paymentDate: new Date(),
          description: existingCollection.description || 'Partial payment',
          receiptNumber: existingCollection.receiptNumber || null,
        });
      } else {
        // For non-yearly payments, set status to 'Paid'
        existingCollection.status = 'Paid';
      }
  
      // Common updates for all payment types
      existingCollection.kudiCollectionType = 'Online';
      existingCollection.accountId = await BankModel.findOne({ primary: true }).lean();
      existingCollection.PaymentDate = new Date();
  
      // Save changes
      await existingCollection.save({ session });
  
      // Credit account logic
      const ref = `/house/house-details/${existingCollection.houseId._id}`;
      const transaction = await creditAccount(
        existingCollection.accountId._id,
        numericAmount,
        existingCollection.description,
        existingCollection.category.name,
        ref,
        session
      );
  
      if (!transaction) {
        await session.abortTransaction();
        session.endSession();
        return false; // Return false if crediting account fails
      }
  
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
  
      // Send WhatsApp notifications only after the transaction is committed
      try {
        if (isYearlyPayment) {
          if (existingCollection.paidAmount >= existingCollection.totalAmount) {
            await sendWhatsAppYearlyReceipt(existingCollection);
          } else {
            await sendWhatsAppPartial(existingCollection, numericAmount);
          }
        } else {
          await sendWhatsAppMessageFunction(existingCollection);
        }
      } catch (notificationError) {
        // Log the notification error but do not roll back the transaction
        logger.error('Error sending WhatsApp notification:', notificationError);
      }
  
      return true; // Return true if everything is successful
  
    } catch (error) {
      logger.error('Payment verification error:', error);
  
      // Rollback the transaction only if it hasn't been committed
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
  
      return false; // Return false if any error occurs
    }
  };


const validateWebhookSignature = (payload, signature, secret) => {
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return generatedSignature === signature;
};

router.post("/razorpay", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  // Validate webhook signature
  try {
    const isValid = await validateWebhookSignature(
      JSON.stringify(req.body),
      signature,
      process.env.RAZORPAY_WEBHOOK_SECRET
    );

    if (!isValid) {
      logger.warn("Invalid webhook signature");
      return res.status(400).send("Invalid signature");
    }

    const { event, payload } = req.body;
    // Handle events
    switch (event) {
      case "payment.captured":
        try {
          if (payload?.payment?.notes?.Receipt) {
            const { receiptNumber, amount } = payload.payment.notes;
            await updateReceiptAndAmount({ receiptNumber, amount });
            logger.info("Receipt updated successfully", { receiptNumber, amount });
          } else if (payload?.payment?.notes?.Tenant) {
            logger.info("Rent payment detected", { tenant: payload.payment.notes.Tenant });
            // Add rent processing logic here
          }
        } catch (error) {
          logger.error("Error processing payment.captured event", { error, payload });
        }
        break;

      default:
        break;
    }

    // Acknowledge webhook receipt
    res.status(200).send();
  } catch (error) {
    logger.error("Error processing Razorpay webhook", { error });
    res.status(500).send("Internal Server Error");
  }
});





export default router;


