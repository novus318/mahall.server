import express from "express";
import houseModel from "../model/houseModel.js";
import mongoose from "mongoose";
import memberModel from "../model/memberModel.js";
import kudiCollection from "../model/kudiCollection.js";
import receiptModel from "../model/recieptModel.js";
import { sendWhatsAppMessageFunction } from "../functions/generateMonthlyCollections.js";
import { creditAccount } from "../functions/transaction.js";
const router = express.Router()



router.post('/create-house', async (req, res) => {
    const { newHouse, newMember } = req.body;

    // Validation for house
    if (!newHouse.name || newHouse.name.trim() === '') {
        return res.status(400).send({ success: false, message: 'House name is required' });
    }
    if (!newHouse.number || newHouse.number.trim() === '') {
        return res.status(400).send({ success: false, message: 'House number is required' });
    }
    if(!newHouse.address || newHouse.address.trim() === ''){
        return res.status(400).send({ success: false, message: 'House address is required' });
    }
    if (!['rented', 'owned'].includes(newHouse.status)) {
        return res.status(400).send({ success: false, message: 'Invalid house status' });
    }
    if (newHouse.collectionAmount && isNaN(newHouse.collectionAmount)) {
        return res.status(400).send({ success: false, message: 'Invalid collection amount' });
    }

    // Validation for member
    if (!newMember.name || newMember.name.trim() === '') {
        return res.status(400).send({ success: false, message: 'Member name is required' });
    }
    if (!newMember.status || newMember.status.trim() === '') {
        return res.status(400).send({ success: false, message: 'Member Occupation or status is required' });
    }
    if (newMember.DOB && isNaN(Date.parse(newMember.DOB))) {
        return res.status(400).send({ success: false, message: 'Invalid date of birth' });
    }
    if (newMember.gender && !['male', 'female'].includes(newMember.gender)) {
        return res.status(400).send({ success: false, message: 'Invalid gender' });
    }
    if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(newMember.bloodGroup)) {
        return res.status(400).send({ success: false, message: 'Invalid blood group' });
    }
    if (!newMember.maritalStatus) {
        return res.status(400).send({ success: false, message: 'Marital status is required' });
    }
    if (!newMember.education || !newMember.education.level || 
        !['Below 10th', 'SSLC', 'Plus Two', 'Diploma', 'Bachelors', 'Masters', 'PhD'].includes(newMember.education.level)) {
        return res.status(400).send({ success: false, message: 'Invalid education level' });
    }
    if (!newMember.madrassa || !newMember.madrassa.level || 
        !['Not studied','Below 5th', 'Above 5th', 'Above 10th'].includes(newMember.madrassa.level)) {
        return res.status(400).send({ success: false, message: 'Invalid madrassa level' });
    }
    if (!newMember.place || newMember.place.trim() === '') {
        return res.status(400).send({ success: false, message: 'Member place of residence is required' });
      }
   

    try {
        // Check if house number already exists
        const existingHouse = await houseModel.findOne({ number: newHouse.number });
        if (existingHouse) {
            return res.status(400).send({ success: false, message: 'House number already exists' });
        }

        // Create a new house document
        const house = new houseModel({
            name: newHouse.name,
            panchayathNumber: newHouse.panchayathNumber,
            wardNumber: newHouse.wardNumber,
            number: newHouse.number,
            address: newHouse.address,
            status: newHouse.status,
            rationsStatus: newHouse.rationsStatus,
            collectionAmount: newHouse.collectionAmount,
        });

        const savedHouse = await house.save();

        const member = new memberModel({
            name: newMember.name,
            status: newMember.status,
            DOB: newMember.DOB,
            maritalStatus: newMember.maritalStatus,
            education: newMember.education,
            madrassa: newMember.madrassa,
            gender: newMember.gender,
            mobile: newMember.mobile,
            whatsappNumber: newMember.whatsappNumber,
            place: newMember.place,
            idCards: newMember.idCards,
            bloodGroup: newMember.bloodGroup,
            house: savedHouse._id,
        });

        const savedMember = await member.save();

        if (savedMember) {
            await houseModel.findByIdAndUpdate(savedHouse._id, { familyHead: savedMember._id });
        }else{
            await houseModel.findByIdAndDelete(savedHouse._id);
            return res.status(400).send({ success: false, message: 'Failed to create member try again' });
        }

        res.status(200).send({ success: true, house: savedHouse });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server Error' });
    }
});



router.put('/edit-house', async (req, res) => {
    const { _id, name, number, address, familyHead, collectionAmount, status, rationsStatus, panchayathNumber, wardNumber } = req.body;
    try {
        const updatedHouse = await houseModel.findByIdAndUpdate(_id, { name, number, address, status, rationsStatus, panchayathNumber, wardNumber }, { new: true });
        if (familyHead && mongoose.Types.ObjectId.isValid(familyHead)) {
            updatedHouse.familyHead = familyHead;
        }
        if (collectionAmount) {
            updatedHouse.collectionAmount = collectionAmount;
        }
        await updatedHouse.save();
        if (!updatedHouse) return res.status(404).send({ success: false, message: 'House not found' });
        res.status(200).send({ success: true, house: updatedHouse });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server Error' });
        console.log(error)
    }
});

router.get('/get/:pid', async (req, res) => {

    try {
        const house = await houseModel.findById(req.params.pid).populate('familyHead');
        if (!house) return res.status(404).send({ success: false, message: 'House not found' });
        res.status(200).send({ success: true, house });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server Error' });
    }
});

router.get('/get', async (req, res) => {
    try {
        const houses = await houseModel.find({}).sort({
            createdAt: -1,
        }).populate('familyHead');
        res.status(200).send({ success: true, houses });
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server Error' });
    }
});

router.get('/get-all', async (req, res) => {
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
        res.status(500).send({
            success: false, message: `Server Error: ${error}`,
            error
        });
    }
});
router.get('/get/paid/collections', async (req, res) => {
    try {

        const paidCollections = await kudiCollection.find({ status: 'Paid' }).sort({
            createdAt: -1,
        }).populate('memberId houseId').limit(50)
        res.status(200).send({ success: true, houses: paidCollections });
    } catch (error) {
        res.status(500).send({
            success: false, message: `Server Error: ${error}`,
            error
        });
    }
});

router.put('/reject/collection/:id', async (req, res) => {
    try {
        const {rejectionReason} = req.body;
        const collectionId = req.params.id;

        // Find the kudiCollection by ID and update it
        const updatedCollection = await kudiCollection.findByIdAndUpdate(
            collectionId,
            {
                status: 'Rejected',
                rejectionReason,
                PaymentDate: new Date(),
            },
            { new: true }
        ).populate('memberId houseId');

        if (!updatedCollection) {
            return res.status(404).send({ success: false, message: 'Kudi collection not found' });
        }
     
        res.status(200).send({ success: true, message: 'Kudi collection rejected successfully', data: updatedCollection });
    } catch (error) {
        console.error('Error rejecting kudi collection:', error);
        res.status(500).send({ success: false, message: 'Server Error' });
    }
});
router.put('/update/collection/:id', async (req, res) => {
    try {
        const { paymentType, targetAccount } = req.body;
        const collectionId = req.params.id;

        // Find the kudiCollection by ID and update it
        const updatedCollection = await kudiCollection.findByIdAndUpdate(
            collectionId,
            {
                kudiCollectionType: paymentType,
                accountId: targetAccount,
                status: 'Paid',
                PaymentDate: new Date(),
            },
            { new: true } // Return the updated document
        ).populate('memberId houseId');

        if (!updatedCollection) {
            return res.status(404).send({ success: false, message: 'Kudi collection not found' });
        }
        const ref =`/house/house-details/${updatedCollection.houseId._id}`
        const transaction = creditAccount(updatedCollection.accountId, updatedCollection.amount,
            updatedCollection.description,
            updatedCollection.category.name,
            ref
        )
        if (!transaction) {
            await kudiCollection.findByIdAndUpdate(
                collectionId,
                {
                    kudiCollectionType: paymentType,
                    status: 'Unpaid',
                    accountId: targetAccount,
                    PaymentDate: new Date(),
                },
                { new: true }
            )
            return res.status(400).send({ success: false, message: 'Error crediting account' });
        } else {
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
        const collections = await kudiCollection.find({ memberId }).sort({ createdAt: -1 }).limit(10)
            .populate('memberId')
            .populate('houseId');
        res.status(200).json({ success: true, collections });
    } catch (error) {
        console.error('Error fetching kudi collections by memberId:', error);
        res.status(500).json({ success: false, message: 'Server error. Could not fetch kudi collections.' });
    }
});

router.get('/kudi-contribution/:houseId', async (req, res) => {
    try {
        const { houseId } = req.params;

        // Step 1: Fetch all members associated with the given houseId
        const members = await memberModel.find({ house: houseId }).select('_id name');

        if (!members || members.length === 0) {
            return res.status(404).json({ message: 'No members found for the specified house.' });
        }

        const memberIds = members.map(member => member._id);

        // Step 2: Retrieve all receipts for those members
        const receipts = await receiptModel.find({ 
            memberId: { $in: memberIds }, 
            status: 'Completed'  // Only retrieve completed receipts
        })
        .populate('accountId', 'name')
        .populate('categoryId', 'name')
        .populate('memberId', 'name')
        .sort({ createdAt: -1 });

    const totalContributions = receipts.reduce((total, receipt) => total + receipt.amount, 0);

    res.status(200).json({
        success: true,
        totalContributions,
        receipts
    });

    } catch (error) {
        console.error('Error fetching kudi contributions:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching kudi contributions.'
        });
    }
});




export default router