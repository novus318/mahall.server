import express  from "express";
import transactionModel from "../model/transactionModel.js";
const router=express.Router()



router.get('/get/self-transfer', async (req, res) => {
    try {
      // Find all transactions with the category "Self-Transfer"
      const transactions = await transactionModel.find({ category: 'Self-Transfer' }).sort({createdAt: -1});
      
      // If transactions are found, send them in the response
      res.status(200).send({ success: true, data: transactions });
    } catch (error) {
      // Handle any errors that occur during the query
      res.status(500).send({ success: false, message: 'Failed to retrieve transactions', error: error.message });
    }
  });
  




export default router