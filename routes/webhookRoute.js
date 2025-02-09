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
import buildingModel from "../model/buildingModel.js";


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

  const updateRentCollection = async (props) => {
    const { buildingId, roomId, contractId, rentId, amount, paymentDate } = props;
  
    // Validate required fields
    if (!buildingId || !roomId || !contractId || !rentId || !amount) {
      throw new Error('Missing required fields');
    }
  
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      // Retrieve the building, room, contract, and rent collection
      const building = await buildingModel.findById(buildingId).session(session);
      if (!building) {
        throw new Error('Building not found');
      }
  
      const room = building.rooms.id(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
  
      const contract = room.contractHistory.id(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }
  
      const rentCollection = contract.rentCollection.id(rentId);
      if (!rentCollection) {
        throw new Error('Rent collection not found');
      }
  
      // Validate payment amount
      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error('Invalid payment amount');
      }
  
      // Update rent collection details
      rentCollection.paymentMethod = 'Online';
      rentCollection.PaymentAmount = rentCollection.amount;
      rentCollection.paymentDate = paymentDate || new Date();
      rentCollection.paidAmount = Math.min(rentCollection.paidAmount + numericAmount, rentCollection.PaymentAmount);
      rentCollection.status = rentCollection.paidAmount >= rentCollection.PaymentAmount ? 'Paid' : 'Partial';
  
      // Record partial payment
      rentCollection.partialPayments.push({
        amount: numericAmount,
        paymentDate: paymentDate || new Date(),
        description: `Payment for ${building.buildingID} - Room ${room.roomNumber}`,
        receiptNumber: `RC-${rentCollection.period}`,
      });
  
      // Retrieve the primary bank account
      const primaryAccount = await BankModel.findOne({ primary: true }).lean();
      if (!primaryAccount) {
        throw new Error('Primary bank account not found');
      }
      rentCollection.accountId = primaryAccount._id;
  
      // Process financial transaction
      await creditAccount(
        primaryAccount._id,
        numericAmount,
        `Rent from ${contract.tenant.name} for building ${building.buildingID} room ${room.roomNumber}`,
        'Rent',
        `/rent/room-details/${building._id}/${roomId}/${contractId}`
      );
  
      // Save changes and commit transaction
      await building.save({ session });
      await session.commitTransaction();
  
      return true; // Return true if everything is successful
    } catch (error) {
      // Log the error and roll back the transaction
      await session.abortTransaction();
      logger.error(`updateRentCollection failed: ${error.message}`);
      throw error; // Re-throw the error for the caller to handle
    } finally {
      // End the session
      session.endSession();
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
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Validate webhook signature
  try {
    const isValid = await validateWebhookSignature(
      JSON.stringify(req.body),
      signature,
      webhookSecret
    );

    if (!isValid) {
      logger.warn("Invalid webhook signature", { signature });
      return res.status(400).json({ error: "Invalid signature" });
    }

    const { event, payload } = req.body;

    // Handle events
    switch (event) {
      case "payment.captured":
        await handlePaymentCapturedEvent(payload);
        break;
      default:
        break;
    }

    // Acknowledge webhook receipt
    res.status(200).json({ status: "success" });
  } catch (error) {
    logger.error("Error processing Razorpay webhook", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function handlePaymentCapturedEvent(payload) {
  try {
    if (payload?.payment?.notes?.Receipt) {
      const receiptNumber = payload.payment.notes.Receipt;
      const amountInRupee = payload.payment.entity.amount / 100;

      await updateReceiptAndAmount({ receiptNumber, amount: amountInRupee });
      logger.info("Receipt updated successfully", { receiptNumber, amountInRupee });
    } else if (payload?.payment?.notes?.Tenant) {
      const amountInRupees = payload.payment.entity.amount / 100;

      await updateRentCollection({
        buildingId: payload.payment.notes.buildingId,
        roomId: payload.payment.notes.roomId,
        contractId: payload.payment.notes.contractId,
        rentId: payload.payment.notes.rentId,
        amount: amountInRupees,
        paymentDate: new Date(),
      });

      logger.info("Rent payment detected", { tenant: payload.payment.notes.Tenant });
    }
  } catch (error) {
    logger.error("Error processing payment.captured event", { error: error.message, payload });
    throw error; // Re-throw to handle it in the main catch block
  }
}


// router.get('/test',async (req, res) => {
//   try {
//     await updateRentCollection({
//       buildingId: '67a700aa4a4b58998216e05c',
//       roomId: '67a700aa4a4b58998216e05e',
//       contractId: '67a841bf9c2089be0b0d1256',
//       rentId: '67a841ea63a4fb8cb379c5f6',
//       amount: 2000,
//       paymentDate: new Date(),
//     });
//     return res.status(200).json({
//       success: true,
//       message: 'Payment successful',
//     });
//   } catch (error) {
//     logger.error('Error in test route:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal Server Error',
//       error: error.message,
//     });
//   }
// })




export default router;


