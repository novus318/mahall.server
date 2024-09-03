import express  from "express";
import jwt from "jsonwebtoken";
import memberModel from "../model/memberModel.js";
import mongoose from "mongoose";
const router=express.Router()



router.post('/create', async (req, res) => {
    try {
      const { newMember,selectedRelation,houseId } = req.body;
      // Create a new member instance
      const member = new memberModel({
        name:newMember.name,
        status:newMember.status,
        DOB:newMember.DOB,
        maritalStatus:newMember.maritalStatus,
        education:newMember.education,
        madrassa:newMember.madrassa,
        gender:newMember.gender,
        mobile:newMember.mobile,
        whatsappNumber:newMember.whatsappNumber,
        place:newMember.place,
        idCards:newMember.idCards,
        bloodGroup:newMember.bloodGroup,
        house:houseId,
      });
      if (selectedRelation && mongoose.Types.ObjectId.isValid(selectedRelation.memberId)) {
        member.relation.member = selectedRelation.memberId;
        member.relation.relationType = selectedRelation.relation || ''; // Default to empty string if relation is not provided
      }
  
  
      // Save the new member to the database
      const savedMember = await member.save();
  
      // Send a success response with the saved member
      res.status(201).json({
        success: true,
        member: savedMember,
      });
    } catch (error) {
      // Handle any errors that occur during the member creation process
      console.error(error);
      res.status(500).json({ message: 'An error occurred while creating the member.', error: error.message });
    }
  });

  router.delete('/delete/:id', async (req, res) => {
    try {
      const { id } = req.params;
  
      // Check if the provided ID is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid member ID.' });
      }
  
      // Find the member by ID and delete it
      const deletedMember = await memberModel.findByIdAndDelete(id);
  
      // Check if the member was found and deleted
      if (!deletedMember) {
        return res.status(404).json({ message: 'Member not found.' });
      }
  
      // Send a success response with the deleted member information
      res.status(200).json({
        success: true,
        message: 'Member deleted successfully.',
      });
    } catch (error) {
      res.status(500).json({ message: 'An error occurred while deleting the member.', error: error.message });
    }
  });
  
  
  router.put('/edit-member', async (req, res) => {
    try {
      const { newMember,selectedRelation,houseId,memberId } = req.body;
  console.log(selectedRelation)
      // Create a new member instance
      const updatedmember = await memberModel.findByIdAndUpdate(memberId,{
        name:newMember.name,
        status:newMember.status,
        DOB:newMember.DOB,
        maritalStatus:newMember.maritalStatus,
        education:newMember.education,
        madrassa:newMember.madrassa,
        gender:newMember.gender,
        mobile:newMember.mobile,
        whatsappNumber:newMember.whatsappNumber,
        place:newMember.place,
        idCards:newMember.idCards,
        bloodGroup:newMember.bloodGroup,
        house:houseId,
      });
      if (selectedRelation.memberId && mongoose.Types.ObjectId.isValid(selectedRelation.memberId)) {
        updatedmember.relation.member = selectedRelation.memberId;
      }
      if (selectedRelation.relation) {
        updatedmember.relation.relationType = selectedRelation.relation || ''; 
      }
  
  
      // Save the new member to the database
      const savedMember = await updatedmember.save();
  
      // Send a success response with the saved member
      res.status(201).json({
        success: true,
        member: savedMember,
      });
    } catch (error) {
      // Handle any errors that occur during the member creation process
      console.error(error);
      res.status(500).json({ message: 'An error occurred while creating the member.', error: error.message });
    }
  });

  router.get('/all-members/:pid', async (req, res) => {
    const { pid } = req.params;
  
    try {
      // Validate the pid
      if (!mongoose.Types.ObjectId.isValid(pid)) {
        return res.status(400).json({ 
            success:false,
            message: 'Invalid house ID' });
      }
  
      // Fetch all members with the specified house ID
      const members = await memberModel.find({ house: pid }).populate('relation.member');
  
      // Check if members are found
      if (members.length === 0) {
        return res.status(404).json({ 
            success:false,
            message: 'No members found for this house' });
      }
  
      // Send a success response with the members
      res.status(200).json(
        {success: true,
        members,}
      );
    } catch (error) {
      // Handle any errors that occur during the fetch process
      console.error(error);
      res.status(500).json({ 
        success:false,
        message: 'An error occurred while fetching members.',
        error: error.message,
      });
    }
  });

  router.get('/get-byId/:pid', async (req, res) => {
    const { pid } = req.params;
    try {
      const member = await memberModel.findById(pid).populate('house relation.member');
      if (!member) {
        return res.status(404).json({ 
            success:false,
            message: 'Member not found' });
      }
      const members = await memberModel.find({ house: member.house });
      res.status(200).json({ 
        success: true,
        member,
        members,
      });
    } catch (error) {
      res.status(500).json({ 
        success:false,
        message: 'An error occurred while fetching member.',
        error: error.message,
      });
    }
  })

router.get('/all/names-and-ids', async (req, res) => {
  try {
    const members = await memberModel.find({}, { name: 1, _id: 1 });
    res.status(200).json({ success: true, members });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching member names and IDs', error: error.message });
  }
});


export default router