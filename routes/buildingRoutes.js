import express  from "express";
import buildingModel from "../model/buildingModel.js";
const router=express.Router()



router.post('/create-building', async (req, res) => {
    try {
      const { buildingName, place, buildingID, rooms } = req.body;
  
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


  router.post('/add-contract/:buildingID/:roomNumber', async (req, res) => {
    try {
        const { buildingID, roomNumber } = req.params;
        const { from, to, tenant, rent, deposit, advancePayment } = req.body;

        const building = await buildingModel.findOne({ buildingID });

        if (!building) {
            return res.status(404).json({ message: 'Building not found' });
        }

        const room = building.rooms.find(room => room.roomNumber === roomNumber);

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        const newContract = {
            from,
            to,
            tenant,
            rent,
            deposit,
            advancePayment,
        };

        room.contractHistory.push(newContract);
        await building.save();

        res.status(200).json({
            success:true,
            message: 'Contract added successfully', building });
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


export default router