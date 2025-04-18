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
import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils.js";
import { sendRentConfirmPatial, sendRentConfirmWhatsapp } from "../functions/generateRent.js";


dotenv.config({ path: './.env' })

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "vellap2Mahal";

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

    if (existingCollection.status === 'Paid') {
      await session.abortTransaction();
      session.endSession();
      return true;
    }

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
    logger.error('Missing required fields');
    return false;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Retrieve the building, room, contract, and rent collection
    const building = await buildingModel.findById(buildingId).session(session);
    if (!building) {
      logger.error('Building not found')
      return false;
    }

    const room = building.rooms.id(roomId);
    if (!room) {
      logger.error('Room not found');
      return false;
    }

    const contract = room.contractHistory.id(contractId);
    if (!contract) {
      logger.error('Contract not found');
      return false;
    }

    const rentCollection = contract.rentCollection.id(rentId);
    if (!rentCollection) {
      logger.error('Rent collection not found');
      return false;
    }

    // Validate payment amount
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      logger.error('Invalid payment amount');
      return false;
    }
    if (rentCollection.status === 'Paid') {
      logger.error('Rent collection has already been paid');
      return false;
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
      logger.error('Primary bank account not found');
      return false;
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

    if (rentCollection.status === 'Paid') {
      await sendRentConfirmWhatsapp(rentCollection, contract.tenant, room, building, contract)
    } else {
      await sendRentConfirmPatial(rentCollection, contract.tenant, room, building, contract, amount)
    }

    return true;
  } catch (error) {
    // Log the error and roll back the transaction
    await session.abortTransaction();
    logger.error(`updateRentCollection failed: ${error.message}`);
    return false;
  } finally {
    // End the session
    session.endSession();
  }
};



// const validateWebhookSignature = (payload, signature, secret) => {
//   try {
//     const generatedSignature = crypto
//       .createHmac("sha256", secret)
//       .update(payload, 'utf8')
//       .digest("hex");

//     logger.error(`Generated Signature: ${generatedSignature}`);
//     logger.error(`Received Signature: ${signature}`);

//     return generatedSignature === signature;
//   } catch (error) {
//     logger.error("Error generating webhook signature", { error: error.message });
//     return false;
//   }
// };

router.post("/razorpay", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!signature) {
    logger.error("No signature found in headers");
    return res.status(400).json({ error: "Signature missing" });
  }

  try {
    const { event, payload: eventData } = req.body;

    switch (event) {
      case "payment.captured":
        logger.info("Payment captured event received");
        await handlePaymentCapturedEvent(eventData);
        break;
      default:
        logger.warn(`Unhandled event type: ${event}`);
    }

    res.status(200).json({ status: "success" });
  } catch (error) {
    logger.error(`Error processing Razorpay webhook: ${JSON.stringify(error)}`)
    res.status(200).json({ error: "Internal Server Error" });
  }
});

async function handlePaymentCapturedEvent(payload) {
  try {
    logger.info(`Payment captured event payload:${JSON.stringify(payload)}`);
    if (payload?.payment?.entity?.notes?.Receipt) {
      const receiptNumber = payload.payment?.entity.notes.Receipt;
      const amountInRupee = payload.payment?.entity.amount / 100;

      await updateReceiptAndAmount({ receiptNumber, amount: amountInRupee });
      logger.info(`Receipt updated successfully ${ receiptNumber, amountInRupee }`);
    } else if(payload?.payment?.entity?.notes?.Tenant) {
      const amountInRupees = payload.payment.entity.amount / 100;
      const tenantName = payload.payment.entity.notes.Tenant;

      logger.info(`Rent payment detected for tenant: ${tenantName}`);

      // Update rent collection
      await updateRentCollection({
        buildingId: payload.payment.entity.notes.buildingId,
        roomId: payload.payment.entity.notes.roomId,
        contractId: payload.payment.entity.notes.contractId,
        rentId: payload.payment.entity.notes.rentId,
        amount: amountInRupees,
        paymentDate: new Date(),
      });

      logger.info(`Rent payment successfully processed for tenant: ${tenantName}`);
    }
  } catch (error) {
    logger.error(`Error processing payment.captured event ${JSON.stringify(error)}`);
    throw error;
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


