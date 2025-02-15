import express  from "express";
import memberModel from "../model/memberModel.js";
import houseModel from "../model/houseModel.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
const router=express.Router()



router.post('/create', async (req, res) => {
    try {
      const { newMember,selectedRelation,houseId } = req.body;


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
        member.relation.relationType = selectedRelation.relation || '';
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
      logger.error(error)
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

        // Find the member to check if they are the familyHead of any house
        const member = await memberModel.findById(id).populate('house');

        if (!member) {
            return res.status(404).json({ message: 'Member not found.' });
        }

        // Check if the member is the familyHead of the house
        const house = await houseModel.findOne({ familyHead: id });

        if (house) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete member because they are the familyHead of a house. Update the house familyHead first.',
                houseDetails: house
            });
        }

        // If not a familyHead, proceed with deletion
        const deletedMember = await memberModel.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Member deleted successfully.',
            member: deletedMember,
        });
    } catch (error) {
      logger.error(error)
        res.status(500).json({ 
            message: 'An error occurred while deleting the member.', 
            error: error.message 
        });
    }
});

  
  
  router.put('/edit-member', async (req, res) => {
    try {
      const { newMember, selectedRelation, houseId, memberId } = req.body;
  
      // Create a new member instance and return the updated document
      const updatedmember = await memberModel.findByIdAndUpdate(
        memberId,
        {
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
          house: houseId,
        },
        { new: true } // This option returns the updated document
      );
  
      if (selectedRelation.memberId && mongoose.Types.ObjectId.isValid(selectedRelation.memberId)) {
        updatedmember.relation = {
          member: selectedRelation.memberId,
          relationType: selectedRelation.relation || '',
        };
      } if (selectedRelation.memberId === 'No Relation') {
        updatedmember.relation = undefined;
      }
  
      // Save the updated member to the database
      const savedMember = await updatedmember.save();
  
      // Send a success response with the saved member
      res.status(201).json({
        success: true,
        member: savedMember,
      });
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'An error occurred while creating the member.', error: error.message });
    }
  });

  router.put('/update-member/number', async (req, res) => {
    try {
      const { familyHead } = req.body;

      if (!mongoose.Types.ObjectId.isValid(familyHead._id)) {
        return res.status(400).json({ 
            success:false,
            message: 'Invalid family head ID' });
      }
      // Update the family head of the house
      await memberModel.updateOne({ _id: familyHead._id }, { is_mobile_verified: true });

      res.status(201).json({
        success: true,
        message: 'Family head number updated successfully.',
      });
    } catch (error) {
      logger.error(error)
      res.status(500).json({ message: 'An error occurred while updating member number.', error: error.message });
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
      const members = await memberModel.find({ house: pid });

      const populatedMembers = await Promise.all(
        members.map(async (member) => {
          if (member.relation && member.relation.member) {
            await member.populate('relation.member');
          }
          return member;
        })
      );
  
      // Check if members are found
      if (populatedMembers.length === 0) {
        return res.status(404).json({ 
            success:false,
            message: 'No members found for this house' });
      }
  
      // Send a success response with the members
      res.status(200).json(
        {success: true,
        members:populatedMembers,}
      );
    } catch (error) {
      logger.error(error)
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
      logger.error(error)
      res.status(500).json({ 
        success:false,
        message: 'An error occurred while fetching member.',
        error: error.message,
      });
    }
  })

  router.get('/all/names-and-ids', async (req, res) => {
    try {
      const { search } = req.query;
      const query = search
        ? { name: { $regex: search, $options: 'i' } }
        : {};
  
      const members = await memberModel.find(query, { name: 1, _id: 1 })
        .populate('house', 'number');
  
      res.status(200).json({ success: true, members });
    } catch (error) {
      logger.error(error)
      res.status(500).json({ success: false, message: 'Error fetching member names, IDs, and house numbers', error: error.message });
    }
  });
  
  


export default router