import express from "express"
import kudiCollection from "../model/kudiCollection.js";
import Razorpay from 'razorpay';
import dotenv from 'dotenv'
import crypto from 'crypto';
import mongoose from "mongoose";
import { creditAccount } from "../functions/transaction.js";
import { sendWhatsAppMessageFunction } from "../functions/generateMonthlyCollections.js";
import BankModel from "../model/BankModel.js";
import buildingModel from "../model/buildingModel.js";
import logger from "../utils/logger.js";
import { sendRentConfirmWhatsapp } from "../functions/generateRent.js";
import houseModel from "../model/houseModel.js";
import axios from "axios";
import { sendWhatsAppPartial, sendWhatsAppYearlyReceipt } from "../functions/generateYearlyCollection.js";

dotenv.config({ path: './.env' })

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const router = express.Router()


router.post('/create-order', async (req, res) => {
  try {
    const { amount, receipt } = req.body;
    const options = {
      amount,
      currency: 'INR',
      receipt,
    };
    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    logger.error(error)
    res.status(500).json({ message: 'Unable to create Razorpay order.', error });
  }
})


router.post('/verify-payment', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Validate request body
    const { order_id, payment_id, signature, receiptNumber, amount } = req.body;
    if (!order_id || !payment_id || !signature || !receiptNumber || !amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Find collection by receipt number
    const existingCollection = await kudiCollection.findOne({ receiptNumber })
      .populate('memberId houseId')
      .session(session);

    if (!existingCollection) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    // Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${order_id}|${payment_id}`)
      .digest('hex');
    if (generatedSignature !== signature) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Validate payment amount
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid amount format' });
    }

    const isYearlyPayment = existingCollection.paymentType === 'yearly';

    // Validate monthly payment amount
    if (!isYearlyPayment && numericAmount !== existingCollection.amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: `Monthly payment must be exactly ₹${existingCollection.amount}`
      });
    }

    // Validate yearly payment limits
    if (isYearlyPayment) {
      const newPaidAmount = existingCollection.paidAmount + numericAmount;
      if (newPaidAmount > existingCollection.totalAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: 'Payment exceeds total amount due' 
        });
      }

      existingCollection.paidAmount = newPaidAmount;
      existingCollection.status = newPaidAmount >= existingCollection.totalAmount 
        ? 'Paid' 
        : 'Partial';
      existingCollection.partialPayment = true;

      // Add partial payment details for yearly payments
      existingCollection.partialPayments.push({
        amount: numericAmount,
        paymentDate: new Date(),
        description: existingCollection.description || 'Partial payment',
        receiptNumber: existingCollection.receiptNumber || null,
      });
    }

    // Common updates for all payment types
    existingCollection.kudiCollectionType = 'Online';
    existingCollection.status= 'Paid';
    existingCollection.accountId = await BankModel.findOne({ primary: true }).lean();
    existingCollection.PaymentDate = new Date();

    // Save changes
    await existingCollection.save({ session });

    // Credit account logic
    const ref = `/house/house-details/${existingCollection.houseId._id}`;
    const transaction = await creditAccount(
      existingCollection.accountId._id,
      numericAmount, // Use validated numeric amount
      existingCollection.description,
      existingCollection.category.name,
      ref,
      session
    );

    if (!transaction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Error crediting account' });
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

    res.status(200).json({
      success: true,
      message: 'Payment verified and processed successfully',
      updatedCollection: existingCollection
    });

  } catch (error) {
    logger.error('Payment verification error:', error);

    // Rollback the transaction only if it hasn't been committed
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    res.status(500).json({ success: false, message: 'Payment processing failed', error: error.message });
  }
});


router.get('/house-collection/:recieptNo', async (req, res) => {
  const { recieptNo } = req.params;
  try {
    if (recieptNo) {
      const houseCollection = await kudiCollection.findOne({ receiptNumber: recieptNo }).sort({ createdAt: -1 }).limit(10)
        .populate('memberId')
        .populate('houseId');
      if (!houseCollection) {
        return res.status(404).send({ success: false, message: 'House collection not found' });
      }

      return res.status(200).json({ success: true, houseCollection });
    }

  } catch (error) {
    logger.error(error);
    return res.status(500).send({ success: false, message: 'Server error' });
  }
});

router.get('/rent-collection/:buildingID/:roomId/:contractId/:rentId', async (req, res) => {
  const { buildingID, roomId, contractId, rentId } = req.params;
  try {
    const building = await buildingModel.findById(buildingID);
    if (!building) {
      return res.status(404).send({ success: false, message: 'Building not found' });
    }
    const room = building.rooms.id(roomId);
    if (!room) {
      return res.status(404).send({ success: false, message: 'Room not found' });
    }
    const activeContract = room.contractHistory.find(
      contract => contract._id.toString() === contractId
    );
    if (!activeContract) {
      return res.status(404).send({ success: false, message: 'Contract not found' });
    }
    const rentCollection = activeContract.rentCollection.id(rentId);
    if (!rentCollection) {
      return res.status(404).send({ success: false, message: 'Rent collection not found' });
    }
    const tenant = activeContract.tenant
    return res.status(200).json({ success: true, rentCollection, tenant });
  } catch (error) {
    logger.error(error);
    return res.status(500).send({ success: false,
      message: 'Error: ' + error
    })
  }
});

router.post('/verify/rentpayment', async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { order_id, payment_id, signature, buildingId, roomId, contractId, rentId } = req.body;

    // Validate required fields
    if (!order_id || !payment_id || !signature || !buildingId || !roomId || !contractId || !rentId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${order_id}|${payment_id}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Fetch primary account
    const targetAccount = await BankModel.findOne({ primary: true }).lean();
    if (!targetAccount) {
      return res.status(404).json({ success: false, message: 'Primary account not found' });
    }

    session.startTransaction();

    // Fetch building and related details
    const building = await buildingModel.findById(buildingId).session(session);
    if (!building) {
      throw new Error('Building not found');
    }

    const room = building.rooms.id(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const activeContract = room.contractHistory.find(
      contract => contract._id.toString() === contractId
    );
    if (!activeContract) {
      throw new Error('Contract not found');
    }

    const rentCollection = activeContract.rentCollection.id(rentId);
    if (!rentCollection) {
      throw new Error('Rent collection not found');
    }

    // Update rent collection fields
    Object.assign(rentCollection, {
      status: 'Paid',
      PaymentAmount: rentCollection.amount,
      paymentMethod: 'Online',
      paymentDate: new Date(),
      accountId: targetAccount._id,
    });

    const description = `Rent from ${activeContract.tenant.name} for building ${building.buildingID} room ${room.roomNumber}`;
    const ref = `/rent/room-details/${building._id}/${roomId}/${contractId}`;
    const category = 'Rent';

    // Perform credit transaction
    try {
      await creditAccount(targetAccount._id, rentCollection.amount, description, category, ref);
    } catch (transactionError) {
      // Rollback changes in the database if the credit transaction fails
      throw new Error(`Credit transaction failed: ${transactionError.message}`);
    }

    // Save building changes
    await building.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // Notify tenant
    await sendRentConfirmWhatsapp(rentCollection, activeContract.tenant, room, building, activeContract);

    res.status(200).json({
      success: true,
      message: 'Rent payment verified and processed successfully',
      rentCollection,
    });
  } catch (error) {
    logger.error('Error in payment verification:', error);

    // Rollback transaction in case of an error
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed',
    });
  } finally {
    session.endSession();
  }
});



router.post('/generate-payment/link', async (req, res) => {
  const { house, amount } = req.body;

  try {
    // Validate input
    if (!house || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Fetch house details
    const houseDetails = await houseModel.findOne({ number: house }).populate('familyHead');
    if (!houseDetails) {
      return res.status(404).json({ success: false, message: 'House not found' });
    }

    const familyHead = houseDetails.familyHead;

    // Ensure family head has the required fields
    if (!familyHead || !familyHead.whatsappNumber || !familyHead.name) {
      return res.status(400).json({
        success: false,
        message: 'House family head details are incomplete'
      });
    }

    const today = new Date()
    // Generate payment link
    const paymentLinkData = {
      amount: amount * 100, // Convert to paisa (smallest currency unit)
      currency: 'INR',
      accept_partial: true,
      reference_id: `${houseDetails.number}-${today.getFullYear()}-${today.toLocaleString('default', { month: 'long' })}-${today.toLocaleString('default', { weekday: 'long' })}`,
      description: `Payment for house ${houseDetails.number}`,
      customer: {
        name: familyHead.name,
        contact: familyHead.whatsappNumber,
      },
      notify: {
        sms: true,
        email: false,
        whatsapp: true,
      },
      reminder_enable: true,
    };

    const paymentLink = await razorpay.paymentLink.create(paymentLinkData);

    const shortUrlPart = paymentLink.short_url.replace('https://rzp.io', '');

    try {
      const whatsappResponse = await axios.post(
        WHATSAPP_API_URL,
        {
          messaging_product: 'whatsapp',
          to: familyHead.whatsappNumber,
          type: 'template',
          template: {
            name: 'payment_link_generate', // Replace with your WhatsApp template name
            language: {
              code: 'ml', // Replace with appropriate language code
            },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: `${familyHead.name}` },
                  { type: 'text', text: `${amount}` },
                ],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [
                  { type: 'text', text: shortUrlPart },
                ],
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`, // Replace with your access token
            'Content-Type': 'application/json',
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Payment link generated and sent via WhatsApp successfully',
        link: paymentLink.short_url,
        whatsappResponse: whatsappResponse.data,
      });
    } catch (whatsappError) {
      logger.error(`WhatsApp API Error:`,whatsappError.error.message);
      return res.status(500).json({
        success: false,
        message: 'Payment link generated, but failed to send via WhatsApp',
        link: paymentLink.short_url,
        whatsappError: whatsappError.response?.data || whatsappError.message,
      });
    }
  } catch (error) {
    logger.error(`Error generating payment link: ${error.message  || error}`);
    return res.status(500).json({
      success: false,
      message: `Internal Server Error`,
      error: error.message,
    });
  }
});



export default router;
