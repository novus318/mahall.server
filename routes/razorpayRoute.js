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
import { sendRentConfirmWhatsapp } from "../functions/generateRent.js";

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

router.get('/rent-collection/:buildingID/:roomId/:contractId/:rentId', async (req, res) => {
    const { buildingID, roomId,contractId,rentId } = req.params;
    try{
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
          return res.status(200).json({ success: true, rentCollection,tenant });
    }catch (error) {
    
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
      console.error('Error in payment verification:', error);
  
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
  

export default router;
