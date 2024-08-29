import express  from "express";
import houseModel from "../model/houseModel.js";
import mongoose from "mongoose";
import memberModel from "../model/memberModel.js";
import kudiCollection from "../model/kudiCollection.js";
import { sendWhatsAppMessageFunction } from "../functions/generateMonthlyCollections.js";
import { creditAccount } from "../functions/transaction.js";
const router=express.Router()



router.post('/create-house', async (req, res) => {
    const { newHouse, newMember } = req.body;
    try {
        const existingHouse = await houseModel.findOne({ number: newHouse.number });

        if (existingHouse) {
            return res.status(400).send({ success: false, message: 'House number already exists' });
        }
        // Create a new house document
        const house = new houseModel({
            name: newHouse.name,
            number: newHouse.number,
            address: newHouse.address,
            status: newHouse.status,
            rationsStatus: newHouse.rationsStatus,
            collectionAmount: newHouse.collectionAmount,
        });

        // Save the house to the database
        const savedHouse = await house.save();

        // Create a new member document with the house reference
        const member = new memberModel({
            name: newMember.name,
            status: newMember.status,
            DOB: newMember.DOB,
            maritalStatus: newMember.maritalStatus,
            education: newMember.education,
            gender: newMember.gender,
            mobile: newMember.mobile,
            place:newMember.place,
            house: savedHouse._id, // Reference to the newly created house
        });

        // Save the member to the database
        const savedMember = await member.save();

        if (savedMember) {
            // Update the house with the familyHead set to the saved member's ID
            await houseModel.findByIdAndUpdate(savedHouse._id, { familyHead: savedMember._id });
        }

        res.status(200).send({ success: true, house: savedHouse });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server Error' });
        console.log(error);
    }
});


router.put('/edit-house', async(req, res) => {
    const { _id, name,number,address,familyHead,collectionAmount,status,rationsStatus } = req.body;
try {
    const updatedHouse = await houseModel.findByIdAndUpdate(_id, { name,number,address,status,rationsStatus }, { new: true });
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
       }).populate('familyHead');
       res.status(200).send({ success: true, houses });
   } catch (error) {
       res.status(500).send({ success: false, message: 'Server Error' });
   }
});

router.get('/get-all', async(req, res) => {
    try {
        const houses = await houseModel.find({}).sort({
          createdAt: -1,
        }).populate('familyHead');
        res.status(200).send({ success: true, houses });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server Error' });
    }
 });

 router.get('/get/pending/collections', async (req, res) => {
    try {

        const pendingCollections = await kudiCollection.find({ status: 'Unpaid' }).sort({
            createdAt: -1,
          }).populate('memberId houseId')
        res.status(200).send({ success: true, houses: pendingCollections });
    } catch (error) {
        res.status(500).send({ success: false, message: `Server Error: ${error}`,
            error
         });
    }
});
router.get('/get/paid/collections', async (req, res) => {
    try {

        const paidCollections = await kudiCollection.find({ status: 'Paid' }).sort({
            createdAt: -1,
          }).populate('memberId houseId')
        res.status(200).send({ success: true, houses: paidCollections });
    } catch (error) {
        res.status(500).send({ success: false, message: `Server Error: ${error}`,
            error
         });
    }
});

router.put('/update/collection/:id', async (req, res) => {
    try {
        const { paymentType } = req.body;
        const collectionId = req.params.id;

        // Find the kudiCollection by ID and update it
        const updatedCollection = await kudiCollection.findByIdAndUpdate(
            collectionId,
            {
                kudiCollectionType: paymentType, 
                status: 'Paid', 
                PaymentDate: new Date(),
            },
            { new: true } // Return the updated document
        ).populate('memberId houseId');

        if (!updatedCollection) {
            return res.status(404).send({ success: false, message: 'Kudi collection not found' });
        }
        const transaction = creditAccount(updatedCollection.accountId,updatedCollection.amount,
            updatedCollection.description,
            updatedCollection.category.name
        )
        if (!transaction) {
            await kudiCollection.findByIdAndUpdate(
                collectionId,
                {
                    kudiCollectionType: paymentType, 
                    status: 'Unpaid', 
                    PaymentDate: new Date(),
                },
                { new: true }
            )
            return res.status(400).send({ success: false, message: 'Error crediting account' });
        }else{
        await sendWhatsAppMessageFunction(updatedCollection);
        }
        res.status(200).send({ success: true, message: 'Kudi collection updated successfully', data: updatedCollection });
    } catch (error) {
        console.error('Error updating kudi collection:', error);
        res.status(500).send({ success: false, message: 'Server Error' });
    }
});

router.get('/kudi-collections/:memberId', async (req, res) => {
    try {
        const { memberId } = req.params;
        
        // Find kudi collections by memberId
        const collections = await kudiCollection.find({ memberId }).sort({createdAt: -1})
            .populate('memberId')  
            .populate('houseId'); 
        res.status(200).json({success:true ,collections});
    } catch (error) {
        console.error('Error fetching kudi collections by memberId:', error);
        res.status(500).json({ success:false,message: 'Server error. Could not fetch kudi collections.' });
    }
});




export default router