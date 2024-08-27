import express  from "express";
import jwt from "jsonwebtoken";
import BankModel from "../model/BankModel.js";
import transactionModel from "../model/transactionModel.js";
const router=express.Router()


const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0; // Handle division by zero
    return ((current - previous) / previous) * 100;
};
router.get('/get-assets', async(req, res) => {
    try{
        // Fetch all assets from the database
        const assets = await BankModel.find();

        const totalBalance = assets.reduce((sum, asset) => sum + asset.balance, 0);
        res.status(200).json({ success: true, asset:totalBalance });
    }catch(error){
        res.status(500).json({
            error,
            success: false,
            message: 'Error getting assets' });
    }
});

router.get('/get-expenses', async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Fetch all debit transactions for this month
        const currentMonthExpenses = await transactionModel.aggregate([
            { $match: { type: 'Debit', category: { $ne: 'Self-Transfer' }, date: { $gte: startOfMonth, $lte: now } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Fetch all debit transactions for the last month, excluding 'Self-Transfer' category
        const lastMonthExpenses = await transactionModel.aggregate([
            { $match: { type: 'Debit', category: { $ne: 'Self-Transfer' }, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const currentMonthTotal = currentMonthExpenses.length ? currentMonthExpenses[0].total : 0;
        const lastMonthTotal = lastMonthExpenses.length ? lastMonthExpenses[0].total : 0;

        // Calculate the percentage change
        const percentageChange = calculatePercentageChange(currentMonthTotal, lastMonthTotal);

        res.status(200).json({
            success: true,
            currentMonthTotal,
            lastMonthTotal,
            percentageChange
        });
    } catch (error) {
        res.status(500).json({
            error,
            success: false,
            message: 'Error getting expenses'
        });
    }
});


router.get('/get-transactions', async (req, res) => {
    try {
        const recentTransactions = await transactionModel.find({ category: { $ne: 'Self-Transfer' } })
        .sort({ createdAt: -1 })
        .limit(50);
        res.status(200).json({ success: true, recentTransactions });
    }catch{
        res.status(500).json({
            success: false,
            message: 'Error getting recent transactions'
        });
    }
})


export default router