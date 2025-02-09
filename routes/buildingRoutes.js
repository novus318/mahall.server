import express from "express";
import buildingModel from "../model/buildingModel.js";
import { creditAccount, debitAccount, deleteCreditTransaction } from "../functions/transaction.js";
import mongoose from "mongoose";
import recieptCategoryModel from "../model/recieptCategoryModel.js";
import recieptModel from "../model/recieptModel.js";
import recieptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "../functions/recieptNumber.js";
import { sendRentConfirmWhatsapp } from "../functions/generateRent.js";
import BankModel from "../model/BankModel.js";
import logger from "../utils/logger.js";
const router = express.Router()



router.post('/create-building', async (req, res) => {
  try {
    const { buildingName, place, buildingID, rooms } = req.body;

    // Check if building ID already exists
    const existingBuilding = await buildingModel.findOne({ buildingID: buildingID });
    if (existingBuilding) {
      return res.status(400).send({ success: false, message: 'Building ID already exists' });
    }
    // Create a new building document
    const newBuilding = new buildingModel({
      buildingName,
      place,
      buildingID,
      rooms: rooms.map(room => ({ roomNumber: room }))
    });

    await newBuilding.save();
    res.status(201).json({
      success: true,
      message: 'Building created successfully', building: newBuilding
    });
  } catch (error) {
    logger.error(error)
    res.status(500).json({
      success: false, message: 'Error creating building', error: error.message
    });
  }
});


router.post('/add-room', async (req, res) => {
  try {
    const { buildingID, roomNumber } = req.body;

    // Find the building by buildingID
    const building = await buildingModel.findById(buildingID);

    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    // Check if the room number already exists in the building
    const existingRoom = building.rooms.find(room => room.roomNumber === roomNumber);
    if (existingRoom) {
      return res.status(400).json({ success: false, message: 'Room number already exists in this building' });
    }

    // Add the new room to the rooms array
    building.rooms.push({ roomNumber });

    // Save the updated building document
    await building.save();

    res.status(200).json({
      success: true,
      message: 'Room added successfully',
      building: building
    });
  } catch (error) {
    logger.error(error)
    res.status(500).json({
      success: false,
      message: 'Error adding room',
      error: error.message
    });
  }
});


router.post('/add-contract/:buildingID/:roomId', async (req, res) => {
  try {
    const { buildingID, roomId } = req.params;
    const { from, to, tenant, rent, shop, deposit } = req.body;

    const building = await buildingModel.findById(buildingID);

    if (!building) {
      return res.status(404).json({ message: 'Building not found' });
    }

    const room = building.rooms.id(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.contractHistory && room.contractHistory.length > 0) {
      const lastContract = room.contractHistory[room.contractHistory.length - 1];
      if(lastContract.depositStatus === 'Returned'){
        lastContract.status = 'inactive';
      }else{
        return res.status(400).json({ message: 'Cannot add a new contract while the last contract deposit is not returned' });
      }
    }

    // Create the new contract
    const newContract = {
      from,
      to,
      tenant,
      shop,
      rent,
      deposit,
      status: 'active' 
    };

    room.contractHistory.push(newContract);
    await building.save();

    res.status(200).json({
      success: true,
      contractId:newContract._id,
      message: 'Contract added successfully'
    });
  } catch (error) {
    logger.error(error)
    res.status(500).json({
      success: false, message: 'Error adding contract', error: error.message
    });
  }
});

router.put('/edit-room/:buildingID/:roomId', async (req, res) => {
  try {
    const { buildingID, roomId } = req.params;
    const {roomNumber,buildingName } = req.body;

    const building = await buildingModel.findById(buildingID);

    if (!building) {
      return res.status(404).json({ message: 'Building not found' });
    }

    const room = building.rooms.id(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

  room.roomNumber =roomNumber
  building.buildingName=buildingName

    await building.save();

    res.status(200).json({
      success: true,
      message: 'edited successfully'
    });
  } catch (error) {
    logger.error(error)
    res.status(500).json({
      success: false, message: 'Error editing', error: error.message
    });
  }
});
router.put('/edit-contract/:buildingID/:roomId/:contractId', async (req, res) => {
  try {
    const { buildingID, roomId,contractId } = req.params;
    const { from, to, tenant, rent, shop } = req.body;

    const building = await buildingModel.findById(buildingID);

    if (!building) {
      return res.status(404).json({ message: 'Building not found' });
    }

    const room = building.rooms.id(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const activeContract = room.contractHistory.find(
      contract => contract._id.toString() === contractId
    );
    if (!activeContract) {
      throw new Error('No active contract found');
    }
   
        activeContract.from = from;
        activeContract.to = to;
        activeContract.tenant = tenant;
        activeContract.rent = rent;
        activeContract.shop = shop;

    await building.save();

    res.status(200).json({
      success: true,
      message: 'Contract edited successfully'
    });
  } catch (error) {
    logger.error(error)
    res.status(500).json({
      success: false, message: 'Error editing contract', error: error.message
    });
  }
});

router.post('/pay-deposit/:buildingID/:roomId/:contractId', async (req, res) => {
  const session = await mongoose.startSession(); // Start a session for transaction
  session.startTransaction(); // Start the transaction

  try {
    const { buildingID, roomId,contractId } = req.params;
    const { status, paymentMethod,accountId } = req.body;

    if (status === 'Paid' && !accountId) {
      return res.status(400).json({ message: 'Account ID is required for Paid status.' });
    }
    // Find the building by ID
    const building = await buildingModel.findById(buildingID).session(session); // Use session with queries
    if (!building) {
      throw new Error('Building not found');
    }

    // Find the room by ID
    const room = building.rooms.id(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Find the current active contract
    const activeContract = room.contractHistory.find(
      contract => contract._id.toString() === contractId
    );
    if (!activeContract) {
      throw new Error('No active contract found');
    }

    if (status === 'Paid') {
      activeContract.depositStatus = 'Paid';

      // Create a new deposit transaction
      const depositTransaction = {
        amount: activeContract.deposit,
        transactionType: 'Paid',
        paymentMethod: paymentMethod || 'Cash',
      };

      activeContract.depositCollection.push(depositTransaction);
      const ref = `/rent/room-details/${building._id}/${roomId}/${contractId}`;
      const description = `Deposit from ${activeContract.tenant.name} for building ${building.buildingID} room ${room.roomNumber}`;
      const category = 'building deposit';

      // Assuming creditAccount is an async function, we ensure it runs in a transactional context
      await creditAccount(accountId, activeContract.deposit, description, category, ref);
    } else {
      // Just update the deposit status
      activeContract.depositStatus = status;
    }

    // Save the building along with changes to the contract within the transaction
    await building.save({ session });

    // Commit the transaction since everything was successful
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Deposit paid successfully',
    });

  } catch (error) {
    logger.error(error)
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: 'Error updating deposit status',
      error: error.message
    });
  }
});
router.post('/pay-advance/:buildingID/:roomId/:contractId', async (req, res) => {
  const session = await mongoose.startSession(); // Start a session for transaction
  session.startTransaction(); // Start the transaction

  try {
    const { buildingID, roomId,contractId } = req.params;
    const { amount, accountId } = req.body;

    // Input validation
    if (!mongoose.Types.ObjectId.isValid(buildingID)) {
      throw new Error('Invalid Building ID');
    }

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      throw new Error('Invalid Room ID');
    }

    // Find the building by ID
    const building = await buildingModel.findById(buildingID).session(session);
    if (!building) {
      throw new Error('Building not found');
    }

    // Find the room by ID
    const room = building.rooms.id(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Find the current active contract
    const activeContract = room.contractHistory.find(
      contract => contract._id.toString() === contractId
    );
    if (!activeContract) {
      throw new Error('No active contract found');
    }

    // Update advance payment
    activeContract.advancePayment += Number(amount);

    // Prepare description and ref for payment
    const description = `Advance payment from ${activeContract.tenant.name} for building ${building.buildingID} room ${room.roomNumber}`;
    const category = 'Rent';
    const ref = `/rent/room-details/${building._id}/${roomId}/${contractId}`;

    // Credit the account (External service call)
    await creditAccount(accountId, amount, description, category, ref);

    // Save the building document
    await building.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Send success response
    return res.status(200).json({
      success: true,
      message: 'Advance paid successfully',
    });
  } catch (error) {
    logger.error(error)
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    // Send error response
    return res.status(500).json({
      success: false,
      message: 'Error updating advance status',
      error: error.message,
    });
  }
}
);

router.post('/return-deposit/:buildingID/:roomId/:contractId', async (req, res) => {
  const session = await mongoose.startSession(); // Start a session for transaction
  session.startTransaction(); // Start the transaction

  try {
    const { buildingID, roomId, contractId } = req.params;
    const { status, paymentMethod,accountId } = req.body;

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(buildingID) || 
        !mongoose.Types.ObjectId.isValid(roomId) || 
        !mongoose.Types.ObjectId.isValid(contractId) ||
        !mongoose.Types.ObjectId.isValid(accountId)
      ) {
      return res.status(400).json({ success: false, message: 'Invalid account ,building, room, or contract ID' });
    }

    if (!accountId) {
      return res.status(400).json({ message: 'Account ID is required for Returned status.' });
    }
    // Find the building by ID
    const building = await buildingModel.findById(buildingID).session(session);
    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    // Find the room by ID
    const room = building.rooms.id(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Find the current active contract
    const activeContract = room.contractHistory.find(
      contract => contract._id.toString() === contractId
    );
    if (!activeContract) {
      return res.status(404).json({ success: false, message: 'No active contract found' });
    }

    const ref = `/rent/room-details/${building._id}/${roomId}/${contractId}`;
    if (status === 'Returned') {
      activeContract.depositStatus = 'Returned';
      activeContract.status = 'inactive';
      activeContract.to = Date.now();

      // Create a new deposit transaction
      const depositTransaction = {
        amount: activeContract.deposit,
        transactionType: 'Returned',
        paymentMethod: paymentMethod || 'Cash',
      };
      activeContract.depositCollection.push(depositTransaction);

      // Find the account to debit
      const description = `Returned deposit for ${activeContract.tenant.name} building ${building.buildingID} room ${room.roomNumber}`;
      const category = 'building deposit';

      // Debit the account
      await debitAccount(accountId, activeContract.deposit, description, category, ref);
    } else {
      activeContract.depositStatus = 'ReturnPending';
    }

    // Save the changes
    await building.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Deposit returned successfully',
    });

  } catch (error) {
    // Rollback the transaction
    await session.abortTransaction();
    session.endSession();
    logger.error(error)
    res.status(500).json({
      success: false,
      message: 'Error updating deposit status',
      error: error.message
    });
  } finally {
    session.endSession(); // Make sure the session is closed
  }
});


router.get('/get-buildings', async (req, res) => {

  try {
    const buildings = await buildingModel.find().sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, buildings });
  } catch (error) {
    logger.error(error)
    res.status(500).json({ success: false, message: 'Server Error' });
  }
})

router.get('/get-ByRoom/:buildingID/:roomId/:contractId', async (req, res) => {
  const { buildingID, roomId,contractId } = req.params;
  try {
    // Find the building by its ID
    const building = await buildingModel.findById(buildingID);

    if (!building) {
      return res.status(404).json({ message: 'Building not found' });
    }

    // Find the room within the building's rooms array
    const room = building.rooms.id(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    const contract = room.contractHistory.find(
      contract => contract._id.toString() === contractId
    );

    const roomDetails = {
      buildingID: building.buildingID,
      buildingName: building.buildingName,
      roomNumber: room.roomNumber,
      contract: contract || null,
    };
    res.status(200).json({
      success: true,
      message: 'Room fetched successfully',
      roomDetails
    });
  } catch (error) {
    logger.error(error)
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});


router.get('/rent-collections/pending', async (req, res) => {

  try {
    const buildings = await buildingModel.find({
      rooms: {
        $elemMatch: {
          'contractHistory.rentCollection.status': { $in: ['Pending', 'Partial'] }
        }
      }
    }).limit(60).lean();
    const pendingCollections = [];

    buildings.forEach((building) => {
      building.rooms.forEach((room) => {
        room.contractHistory.forEach((contract) => {
          contract.rentCollection.forEach((collection) => {
            if (collection.status === 'Pending' || collection.status === 'Partial') {
              pendingCollections.push({
                buildingID: building.buildingID,
                buildingId:building._id,
                roomId: room._id,
                shop:contract.shop,
                contractId: contract._id,
                buildingName: building.buildingName,
                roomNumber: room.roomNumber,
                tenantName: contract.tenant.name,
                tenantNumber: contract.tenant.number,
                rent: contract.rent,
                rentId:collection._id,
                deposit: contract.deposit,
                period: collection.period,
                amount: collection.amount,
                PaymentAmount: collection.PaymentAmount,
                paidAmount: collection.paidAmount || 0,
                status: collection.status,
                partialPayments: collection.partialPayments,
                dueDate: collection.date,
                advancePayment:contract.advancePayment,
              });
            }
          });
        });
      });
    });

    pendingCollections.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
    res.status(200).json({ success: true, pendingCollections });
  } catch (error) {
    logger.error(error)
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
})

router.put('/update/rent-collection/:buildingID/:roomId/:contractId', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { buildingID, roomId, contractId } = req.params;
        const {
            rentCollectionId,
            paymentType,
            accountId,
            amount,
            PaymentAmount,
            leaveDays,
            leaveDeduction,
            rejectionReason,
            paymentDate,
            newStatus
        } = req.body;

        // Validate payment operations
        if (newStatus !== 'Rejected') {
            if (!accountId) return res.status(400).json({ message: 'Account ID required for payments' });
            if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid payment amount required' });
        }

        // Validate rejection
        if (newStatus === 'Rejected' && !rejectionReason) {
            return res.status(400).json({ message: 'Rejection reason required' });
        }

        // Retrieve related documents
        const building = await buildingModel.findById(buildingID).session(session);
        const room = building?.rooms.id(roomId);
        const contract = room?.contractHistory.id(contractId);
        const rentCollection = contract?.rentCollection.id(rentCollectionId);

        if (!building || !room || !contract || !rentCollection) {
            return res.status(404).json({ message: 'Resource not found' });
        }

        // Handle rejection
        if (newStatus === 'Rejected') {
            rentCollection.status = 'Rejected';
            rentCollection.rejectionReason = rejectionReason;
        } 
        // Handle payments
        else {
            // Update payment details
            rentCollection.paymentMethod = paymentType;
            rentCollection.PaymentAmount = PaymentAmount;
            rentCollection.paymentDate = paymentDate || new Date();
            rentCollection.onleave = { days: leaveDays, deductAmount: leaveDeduction };
            rentCollection.accountId = accountId;

            // Calculate adjusted amount with deductions
            const deductions = (rentCollection.onleave.deductAmount || 0) + (rentCollection.advanceDeduction || 0);
            const adjustedAmount = rentCollection.amount - deductions;

            // Update paid amount and status
            rentCollection.paidAmount = Math.min(rentCollection.paidAmount + amount, adjustedAmount);
            rentCollection.status = rentCollection.paidAmount >= adjustedAmount ? 'Paid' : 'Partial';

            // Record partial payment
            rentCollection.partialPayments.push({
                amount: amount,
                paymentDate: rentCollection.paymentDate,
                description: `Payment for ${building.buildingID} - Room ${room.roomNumber}`,
                receiptNumber: `RC-${Date.now()}`
            });

            // Process financial transaction
            await creditAccount(
                accountId,
                amount,
                `Rent from ${contract.tenant.name} for building ${building.buildingID} room ${room.roomNumber}`,
                'Rent',
                `/rent/room-details/${building._id}/${roomId}/${contractId}`
            ).catch(err => {
                throw new Error(`Payment processing failed: ${err.message}`);
            });
        }

        await building.save({ session });
        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: `Rent ${newStatus === 'Rejected' ? 'rejected' : 'updated'} successfully`,
            data: rentCollection
        });

    } catch (error) {
      console.log(error);
        await session.abortTransaction();
        logger.error(`Rent update failed: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            message: error.message.startsWith('Payment processing') 
                ? 'Payment failed - changes rolled back' 
                : 'Operation failed'
        });
    } finally {
        session.endSession();
    }
});


router.put('/update-partial/rent-collection/:buildingID/:roomId/:contractId', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { buildingID, roomId, contractId } = req.params;
    const { rentCollectionId, paymentType, accountId, amount,paymentDate } = req.body;

    // Validate input parameters
    if (!buildingID || !roomId || !contractId || !rentCollectionId || !paymentType || !accountId || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Retrieve related documents
    const building = await buildingModel.findById(buildingID).session(session);
    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    const room = building.rooms.id(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const contract = room.contractHistory.id(contractId);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    const rentCollection = contract.rentCollection.id(rentCollectionId);
    if (!rentCollection) {
      return res.status(404).json({ success: false, message: 'Rent collection not found' });
    }

    // Update payment details
    rentCollection.paymentMethod = paymentType;

    // Update paid amount and status
    rentCollection.paidAmount = Math.min(rentCollection.paidAmount + amount, rentCollection.PaymentAmount);
    rentCollection.status = rentCollection.paidAmount >= rentCollection.PaymentAmount ? 'Paid' : 'Partial';

    // Record partial payment
    rentCollection.partialPayments.push({
      amount: amount,
      paymentDate: paymentDate || Date.now(),
      description: `Payment for ${building.buildingID} - Room ${room.roomNumber}`,
      receiptNumber: `RC-${rentCollection.period}`
    });

    // Process financial transaction
    await creditAccount(
      accountId,
      amount,
      `Rent from ${contract.tenant.name} for building ${building.buildingID} room ${room.roomNumber}`,
      'Rent',
      `/rent/room-details/${building._id}/${roomId}/${contractId}`
    ).catch(err => {
      throw new Error(`Payment processing failed: ${err.message}`);
    });

    // Save changes and commit transaction
    await building.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Rent updated successfully',
      data: rentCollection
    });

  } catch (error) {
    // Log the error and roll back the transaction
    await session.abortTransaction();
    logger.error(`Rent update failed: ${error.message}`);

    res.status(500).json({
      success: false,
      message: error.message.startsWith('Payment processing') 
        ? 'Payment failed - changes rolled back' 
        : 'Operation failed'
    });
  } finally {
    // End the session
    session.endSession();
  }
});





export default router