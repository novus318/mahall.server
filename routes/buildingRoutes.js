import express from "express";
import buildingModel from "../model/buildingModel.js";
import { creditAccount, debitAccount, deleteCreditTransaction } from "../functions/transaction.js";
import mongoose from "mongoose";
import recieptCategoryModel from "../model/recieptCategoryModel.js";
import recieptModel from "../model/recieptModel.js";
import recieptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "../functions/recieptNumber.js";
import { sendRentConfirmWhatsapp } from "../functions/generateRent.js";
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
    console.log(error)
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
    console.log(error)
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
    console.log(error)
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
    const { status, paymentMethod, accountId } = req.body;

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
    // Rollback the transaction on error
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
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    // Log error (in real scenarios use a logger)
    console.error(error);

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
  try {
    const { buildingID, roomId, contractId } = req.params;
    const { status, accountId, amount, deduction, receiptId } = req.body;
    const deductAmount = Number(deduction) || 0;

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(buildingID) || !mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(contractId)) {
      return res.status(400).json({ message: 'Invalid IDs' });
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    if (!accountId) {
      return res.status(400).json({ message: 'Account ID is required' });
    }

    // Find the building by ID
    const building = await buildingModel.findById(buildingID);
    if (!building) {
      return res.status(404).json({ message: 'Building not found' });
    }

    // Find the room by ID
    const room = building.rooms.id(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
let receiptCategory
    if(deductAmount > 0){
      receiptCategory = await recieptCategoryModel.findById(receiptId);
    if (!receiptCategory && deductAmount > 0) {
      return res.status(404).json({ message: 'Receipt category not found' });
    }
    }

    // Find the current active contract
    const activeContract = room.contractHistory.find(
      contract => contract._id.toString() === contractId
    );
    if (!activeContract) {
      return res.status(404).json({ message: 'No contract found' });
    }

    const ref = `/rent/room-details/${building._id}/${roomId}/${contractId}`;
    if (status === 'Returned') {
      activeContract.depositStatus = 'Returned';
      activeContract.status = 'inactive';
      activeContract.to = Date.now()

      // Create a new deposit transaction
      const depositTransaction = {
        amount,
        transactionType: 'Returned',
        deduction: deductAmount,
        deductionReason: deductAmount > 0 ? receiptCategory.name : '',
      };
      activeContract.depositCollection.push(depositTransaction);

      let transaction;
      if (deductAmount > 0) {
        const otherRecipient = {
          name: activeContract.tenant.name,
          number: activeContract.tenant.number
        };
        const receiptNumber = await recieptNumberModel.findOne();

        if (receiptNumber && receiptNumber.receiptReceiptNumber) {
          const lastNumber = receiptNumber.receiptReceiptNumber.lastNumber;
          const newNumber = await NextReceiptNumber(lastNumber);

          const newReciept = new recieptModel({
            amount: deductAmount,
            date: Date.now(),
            description: `Deducted from deposit of ${activeContract.tenant.name} building ${building.buildingID} room ${room.roomNumber} for ${receiptCategory.name}`,
            accountId,
            categoryId: receiptCategory._id,
            status: 'Pending',
            recieptType: 'Cash',
            memberId: null,
            otherRecipient: otherRecipient,
            receiptNumber: newNumber
          });

          await newReciept.save();

          try {
            transaction = await creditAccount(accountId, deductAmount, newReciept.description, receiptCategory.name,ref);
            if (!transaction) throw new Error('Transaction failed');

            newReciept.status = 'Completed';
            newReciept.transactionId = transaction._id;
            await newReciept.save();

            // Update receipt number
            const updatedReceiptNumber = await recieptNumberModel.findOne();
            if (updatedReceiptNumber) {
              updatedReceiptNumber.receiptReceiptNumber.lastNumber = newNumber;
              await updatedReceiptNumber.save();
            }
          } catch (error) {
            await recieptModel.findByIdAndDelete(newReciept._id);
            return res.status(500).json({ success: false, message: 'Error creating payment. Transaction failed.' });
          }
        }
      }

      const description = `Returned deposit for ${activeContract.tenant.name} building ${building.buildingID} room ${room.roomNumber}`;
      const category = 'building deposit';

      try {
        await debitAccount(accountId, activeContract.deposit, description, category, ref);
      } catch (error) {
        if (deductAmount > 0 && transaction) {
          await deleteCreditTransaction(transaction._id);
        }
        return res.status(500).json({ success: false, message: 'Debit transaction failed. Deposit process rolled back.' });
      }
    } else {
      activeContract.depositStatus = 'ReturnPending';
    }

    await building.save();

    res.status(200).json({
      success: true,
      message: 'Deposit returned successfully',
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating deposit status',
      error: error.message
    });
  }
});

router.get('/get-buildings', async (req, res) => {

  try {
    const buildings = await buildingModel.find().sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, buildings });
  } catch (error) {
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
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});


router.get('/rent-collections/pending', async (req, res) => {

  try {
    const buildings = await buildingModel.find({
      'rooms.contractHistory.rentCollection.status': 'Pending'
    }).lean();
    const pendingCollections = [];

    buildings.forEach((building) => {
      building.rooms.forEach((room) => {
        room.contractHistory.forEach((contract) => {
          contract.rentCollection.forEach((collection) => {
            if (collection.status === 'Pending') {
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
                dueDate: collection.date,
                advancePayment:contract.advancePayment,
                status: collection.status,
              });
            }
          });
        });
      });
    });

    pendingCollections.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
    res.status(200).json({ success: true, pendingCollections });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
})

router.put('/update/rent-collection/:buildingID/:roomId/:contractId', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction

  try {
    const { buildingID, roomId,contractId } = req.params;
    const { rentCollectionId, paymentType, newStatus, accountId, amount, leaveDays, leaveDeduction, advanceRepayment, rejectionReason, paymentDate } = req.body;

    if (newStatus === 'Paid' && !accountId) {
      return res.status(400).json({ message: 'Account ID is required for Paid status.' });
    }

    // Find the building by ID
    const building = await buildingModel.findById(buildingID).session(session);
    if (!building) {
      throw new Error('Building not found');
    }

    // Find the room within the building
    const room = building.rooms.id(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Find the active contract in the room
    const activeContract = room.contractHistory.find(
      contract => contract._id.toString() === contractId
    );
    if (!activeContract) {
      throw new Error('No active contract found');
    }

    // Find the rent collection record
    const rentCollection = activeContract.rentCollection.id(rentCollectionId);
    if (!rentCollection) {
      throw new Error('Rent collection not found');
    }

    // Store the previous status in case of rollback
    const previousStatus = rentCollection.status;

    // Update rent collection fields
    rentCollection.status = newStatus;
    rentCollection.PaymentAmount = amount;
    rentCollection.paymentMethod = paymentType;
    rentCollection.paymentDate = paymentDate;
    rentCollection.onleave.days = leaveDays;
    rentCollection.onleave.deductAmount = leaveDeduction;
    rentCollection.advanceDeduction = advanceRepayment;
    rentCollection.accountId = accountId;

    let creditTransactionId;

    // Handle payment logic if the status is "Paid"
    if (newStatus === 'Paid') {
      const description = `Rent from ${activeContract.tenant.name} for building ${building.buildingID} room ${room.roomNumber}`;
      const ref = `/rent/room-details/${building._id}/${roomId}/${contractId}`;
      const category = 'Rent';

      try {
        // Credit the account and store transaction ID for possible rollback
        const creditAmount = Number(amount) + Number(advanceRepayment);
        const creditTransaction = await creditAccount(accountId, creditAmount, description, category, ref);
    
        creditTransactionId = creditTransaction._id;

        // If advance repayment is included, attempt to debit the account
        if (advanceRepayment > 0) {
          const advanceDescription = `Advance repayment for ${activeContract.tenant.name} for building ${building.buildingID} room ${room.roomNumber} with rent`;
          const advanceTransaction = await debitAccount(accountId, advanceRepayment, advanceDescription, category, ref);

          if (!advanceTransaction) {
            await deleteCreditTransaction(creditTransactionId);
            rentCollection.status = previousStatus;
            throw new Error('Error debiting advance repayment account');
          } else {
            // Deduct advance payment from active contract
            activeContract.advancePayment -= Number(advanceRepayment);
          }
        }
      } catch (err) {
        rentCollection.status = previousStatus;
        if (creditTransactionId) {
          // Rollback credit transaction if credit was successful but debit failed
          await deleteCreditTransaction(creditTransactionId);
        }
        throw new Error('Error processing payment: ' + err.message);
      }
    }

    // Save the changes to the building document
    await building.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
await sendRentConfirmWhatsapp(rentCollection,activeContract.tenant,room,building,activeContract)
    res.status(200).json({ success: true, message: 'Rent collection status updated successfully', rentCollection });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    console.error(error);

    res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
  }
});





export default router