import express  from "express";
import buildingModel from "../model/buildingModel.js";
const router=express.Router()



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
        success:true,
        message: 'Building created successfully', building: newBuilding });
    } catch (error) {
      res.status(500).json({
        success:false, message: 'Error creating building', error: error.message });
    }
  });


  router.post('/add-contract/:buildingID/:roomId', async (req, res) => {
    try {
        const { buildingID, roomId } = req.params;
        const { from, to, tenant, rent, deposit } = req.body;

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
          lastContract.status = 'inactive';
        }
    
        // Create the new contract
        const newContract = {
          from,
          to,
          tenant,
          rent,
          deposit,
          status: 'active' // Mark the new contract as active
        };

        room.contractHistory.push(newContract);
        await building.save();

        res.status(200).json({
            success:true,
            message: 'Contract added successfully' });
    } catch (error) {
        res.status(500).json({
            success:false, message: 'Error adding contract', error: error.message });
    }
});

router.get('/get-buildings', async (req,res)=>{
  
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
    
    res.status(200).json({
      success: true,
      message: 'Room fetched successfully',
      room
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});


router.get('/rent-collections/pending', async (req,res)=>{
  
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
                roomId: room._id,
                contractId: contract._id,
                buildingName: building.buildingName,
                roomNumber: room.roomNumber,
                tenantName: contract.tenant.name,
                tenantNumber: contract.tenant.number,
                rent: contract.rent,
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

      res.status(200).json({ success: true, pendingCollections });
  } catch (error) {
    console.log(error)
      res.status(500).json({ success: false, message: 'Server Error',error });
  }
})


export default router