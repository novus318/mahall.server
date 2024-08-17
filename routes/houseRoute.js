import express  from "express";
import houseModel from "../model/houseModel.js";
import mongoose from "mongoose";
const router=express.Router()



router.post('/create-house', async(req, res) => {
    const { name,number,address } = req.body;
try {
    const newHouse = new houseModel({ name,number,address });
    await newHouse.save();
    res.status(200).send({ success: true, house: newHouse });
} catch (error) {
    res.status(500).send({ success: false, message: 'Server Error' });
    console.log(error)
}
});
router.put('/edit-house', async(req, res) => {
    const { _id, name,number,address,familyHead,collectionAmount } = req.body;
try {
    const updatedHouse = await houseModel.findByIdAndUpdate(_id, { name,number,address }, { new: true });
    if(familyHead && mongoose.Types.ObjectId.isValid(familyHead)){
        updatedHouse.familyHead = familyHead;
    }
    if(collectionAmount){
        updatedHouse.collectionAmount =collectionAmount;
    }
    await updatedHouse.save();
    if (!updatedHouse) return res.status(404).send({ success: false, message: 'House not found' });
    res.status(200).send({ success: true, house: updatedHouse });
} catch (error) {
    res.status(500).send({ success: false, message: 'Server Error' });
    console.log(error)
}
});
router.get('/get/:pid', async(req, res) => {

    try {
       const house = await houseModel.findById(req.params.pid).populate('familyHead');
       if (!house) return res.status(404).send({ success: false, message: 'House not found' });
       res.status(200).send({ success: true, house });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server Error' });
    }
 });

router.get('/get', async(req, res) => {
   try {
       const houses = await houseModel.find({}).sort({
         createdAt: -1,
       });
       res.status(200).send({ success: true, houses });
   } catch (error) {
       res.status(500).send({ success: false, message: 'Server Error' });
   }
});




export default router