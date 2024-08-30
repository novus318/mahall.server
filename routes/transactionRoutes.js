import express  from "express";
import transactionModel from "../model/transactionModel.js";
const router=express.Router()



router.get('/get/self-transfer', async (req, res) => {
    try {
      // Find all transactions with the category "Self-Transfer"
      const transactions = await transactionModel.find({ category: 'Self-Transfer' }).sort({createdAt: -1});
      
      res.status(200).send({ success: true, data: transactions });
    } catch (error) {
      res.status(500).send({ success: false, message: 'Failed to retrieve transactions', error: error.message });
    }
  });

  router.get('/get/kudi-collection', async (req, res) => {
    try {
      // Find all transactions with the category "Self-Transfer"
      const transactions = await transactionModel.find({ category: 'Kudi collection' }).sort({createdAt: -1});
      
      res.status(200).send({ success: true, data: transactions });
    } catch (error) {
      res.status(500).send({ success: false, message: 'Failed to retrieve transactions', error: error.message });
    }
  });
  
  router.get('/recent/transactions', async (req, res) => {
    try {
      const transactions = await transactionModel.find({ category: { $ne: 'Self-Transfer' } }).sort({ createdAt: -1 }).limit(250);
      
      res.status(200).send({ success: true, data: transactions });
    } catch (error) {
      res.status(500).send({ success: false, message: 'Failed to retrieve transactions', error: error.message });
    }
  })



export default router