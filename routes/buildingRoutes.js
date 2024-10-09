import express from "express";
import buildingModel from "../model/buildingModel.js";
import { creditAccount, debitAccount } from "../functions/transaction.js";
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
      message: 'Contract added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false, message: 'Error adding contract', error: error.message
    });
  }
});

router.post('/pay-deposit/:buildingID/:roomId', async (req, res) => {
  try {
    const { buildingID, roomId } = req.params;
    const { status, paymentMethod,accountId } = req.body;

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

    // Find the current active contract
    const activeContract = room.contractHistory.find(contract => contract.status === 'active');
    if (!activeContract) {
      return res.status(404).json({ message: 'No active contract found' });
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
      const description =`Deposit from ${activeContract.tenant.name} for building ${building.buildingID} room ${room.roomNumber}`
      const category = 'building deposit'
      creditAccount(accountId,activeContract.deposit,description,category)
    } else {
      // Just update the deposit status
      activeContract.depositStatus = status;
    }

    await building.save();

    res.status(200).json({
      success: true,
      message: 'Deposit paid successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating deposit status',
      error: error.message
    });
  }
});

router.post('/return-deposit/:buildingID/:roomId', async (req, res) => {
  try {
    const { buildingID, roomId } = req.params;
    const { status,accountId,amount,deduction,deductionReason } = req.body;

    // Find the building by ID
    const building = await buildingModel.findById(buildingID);
    if (!building) {
      return res.status(404).json({ message: 'Building amount,deduction,deductionReasonnot found' });
    }

    // Find the room by ID
    const room = building.rooms.id(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Find the current active contract
    const activeContract = room.contractHistory.find(contract => contract.status === 'active');
    if (!activeContract) {
      return res.status(404).json({ message: 'No active contract found' });
    }

    if (status === 'Returned') {

      activeContract.depositStatus = 'Returned';
      activeContract.status = 'inactive'
      // Create a new deposit transaction
      const depositTransaction = {
        amount: amount,
        transactionType: 'Returned',
        deduction: deduction || 0,
        deductionReason: deductionReason || '',
      };
      activeContract.depositCollection.push(depositTransaction);
      const description =`Returned deposit for ${activeContract.tenant.name} building ${building.buildingID} room ${room.roomNumber}`
      const category = 'building deposit'
      debitAccount(accountId,amount,description,category)
    } else {
      activeContract.depositStatus = 'ReturnPending';
    }

    await building.save();

    res.status(200).json({
      success: true,
      message: 'Deposit returned successfully',
    });
  } catch (error) {
    console.log(error)
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

router.get('/get-ByRoom/:buildingID/:roomId', async (req, res) => {
  const { buildingID, roomId } = req.params;

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
const roomDetails = {
  buildingID: building.buildingID,
  buildingName: building.buildingName,
  roomNumber:room.roomNumber,
  contractHistory: room.contractHistory.filter(contract => contract.status === 'active')
}
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

router.put('/update/rent-collection/:buildingID/:roomId', async (req, res) => {
  try {
    const { buildingID, roomId } = req.params;
    const { rentCollectionId,paymentType, newStatus, accountId,deductions,amount } = req.body;

    if (!rentCollectionId || !newStatus) {
      return res.status(400).json({ message: "Rent collection ID and new status are required." });
    }

    if (newStatus === 'Paid' && !accountId) {
      return res.status(400).json({ message: "Account ID is required for Paid status." });
    }

    // Find the building by ID
    const building = await buildingModel.findById(buildingID);
    if (!building) {
      return res.status(404).json({ message: "Building not found" });
    }

    // Find the room within the building
    const room = building.rooms.id(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Find the active contract in the room
    const activeContract = room.contractHistory.find((contract) => {
      const currentDate = new Date();
      const contractEndDate = new Date(contract.to);
      return contract.status === 'active' && contractEndDate >= currentDate;
    });

    if (!activeContract) {
      return res.status(404).json({ message: "No active contract found" });
    }

    // Find the rent collection record
    const rentCollection = activeContract.rentCollection.id(rentCollectionId);
    if (!rentCollection) {
      return res.status(404).json({ message: "Rent collection not found" });
    }

    // Store the previous status in case of rollback
    const previousStatus = rentCollection.status;
    rentCollection.status = newStatus;
    rentCollection.deductions = deductions
    rentCollection.amount = amount
    rentCollection.paymentType = paymentType
    rentCollection.paymentDate = new Date();

    if (newStatus === 'Paid') {
      const description = `Rent from ${activeContract.tenant.name} for building ${building.buildingID} room ${room.roomNumber}`;
      const category = 'Rent';

      try {
        await creditAccount(accountId,amount, description, category);
      } catch (err) {
        rentCollection.status = previousStatus;
        return res.status(500).json({ message: "Error crediting account" });
      }
    }
    await building.save();

    res.status(200).json({ success:true, message: "Rent collection status updated successfully", rentCollection });

  } catch (error) {
    console.error(error);
    res.status(500).json({success:false, message: "An error occurred", error });
  }
});




export default router