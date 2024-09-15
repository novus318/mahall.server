import express  from "express";
import BankModel from "../model/BankModel.js";
import recieptModel from "../model/recieptModel.js";
import paymentModel from "../model/paymentModel.js";
import memberModel from "../model/memberModel.js";
import houseModel from "../model/houseModel.js";

const router=express.Router()

router.get('/dashboard', async (req, res) => {
    const assets = await BankModel.find();
    const members = await memberModel.find().countDocuments();
    const totalBalance = assets.reduce((sum, asset) => sum + asset.balance, 0);
    const data = [
        { title: "Tuition Fees", link: 'Tution'},
        { title: "Rent" ,link: 'rent'},
        { title: "Payments", link: 'Payments'},
        { title: "Receipts",  link: 'Reciepts'},
        { title: "Accounts", value: `₹${totalBalance}`, link: 'Accounts'},
        { title: "Members", value: members ,link: 'members'},
        { title: "Staff",  value: "98",link: 'staff'},
      ]
    res.send({
        success:true,
        data:data
    });
});

router.get('/get/reciept/byDate', async (req, res) => {
    try {
        // Get startDate and endDate from query parameters
        const { startDate, endDate } = req.query;

        // If no dates are provided, return an error
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        // Convert the dates to JavaScript Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Set the end date to include the entire day
        end.setHours(23, 59, 59, 999);

        // Query the database for receipts between the given dates
        const reciepts = await recieptModel.find({
            createdAt: { $gte: start, $lte: end }
        }).sort({ createdAt: -1 }).populate('categoryId memberId otherRecipient');

        // If no receipts found
        if (!reciepts || reciepts.length === 0) {
            return res.status(404).json({ success: false, message: 'No receipts found for the given date range' });
        }

        // Return the receipts
        res.status(200).json({ success: true, reciepts });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});
router.get('/get/payment/byDate', async (req, res) => {
    try {
        // Get startDate and endDate from query parameters
        const { startDate, endDate } = req.query;

        // If no dates are provided, return an error
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        // Convert the dates to JavaScript Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Set the end date to include the entire day
        end.setHours(23, 59, 59, 999);

        const payments = await paymentModel.find({
            createdAt: { $gte: start, $lte: end }
        }).sort({ createdAt: -1 }).populate('categoryId memberId otherRecipient');

        // If no receipts found
        if (!payments || payments.length === 0) {
            return res.status(404).json({ success: false, message: 'No payments found for the given date range' });
        }

        // Return the receipts
        res.status(200).json({ success: true, payments });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


router.get('/get/members', async (req, res) => {
    try {
        const houses = await houseModel.find();
        const houseWithMembers = await Promise.all(
            houses.map(async (house) => {
              const members = await memberModel.find({ house: house._id });
      
              return {
                house: house.name,
                totalMembers: members.length,
               houseNumber: house.number,
                members,
              };
            })
          );
  
      res.status(200).json({ success: true, houseWithMembers });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error fetching members with house details', error: error.message });
    }
  });
  


export default router;