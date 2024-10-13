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
        const assets = await BankModel.find({ accountType: { $in: ['bank', 'cash'] } });

        const totalBalance = assets.reduce((sum, asset) => sum + asset.balance, 0).toFixed(2);
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
            { $match: { type: 'Debit',  category: { $nin: ['Self-Transfer', 'building deposit'] }, date: { $gte: startOfMonth, $lte: now } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Fetch all debit transactions for the last month, excluding 'Self-Transfer' category
        const lastMonthExpenses = await transactionModel.aggregate([
            { $match: { type: 'Debit',  category: { $nin: ['Self-Transfer', 'building deposit'] }, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const currentMonthTotal = currentMonthExpenses.length ? currentMonthExpenses[0].total : 0;
        const lastMonthTotal = lastMonthExpenses.length ? lastMonthExpenses[0].total : 0;

        // Calculate the percentage change
        const percentageChange = calculatePercentageChange(currentMonthTotal, lastMonthTotal);

        res.status(200).json({
            success: true,
            currentMonthTotal:currentMonthTotal.toFixed(2),
            lastMonthTotal:lastMonthTotal.toFixed(2),
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

router.get('/get-incomes', async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Fetch all debit transactions for this month
        const currentMonthExpenses = await transactionModel.aggregate([
            { $match: { type: 'Credit', category: { $nin: ['Self-Transfer', 'building deposit'] }, date: { $gte: startOfMonth, $lte: now } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Fetch all debit transactions for the last month, excluding 'Self-Transfer' category
        const lastMonthExpenses = await transactionModel.aggregate([
            { $match: { type: 'Credit', category: { $nin: ['Self-Transfer', 'building deposit'] }, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const currentMonthTotal = currentMonthExpenses.length ? currentMonthExpenses[0].total : 0;
        const lastMonthTotal = lastMonthExpenses.length ? lastMonthExpenses[0].total : 0;  

        // Calculate the percentage change
        const percentageChange = calculatePercentageChange(currentMonthTotal, lastMonthTotal);

        res.status(200).json({
            success: true,
            currentMonthTotal:currentMonthTotal.toFixed(2),
            lastMonthTotal:lastMonthTotal.toFixed(2),
            percentageChange
        });
    } catch (error) {
        res.status(500).json({
            error,
            success: false,
            message: 'Error getting income'
        });
    }
});



router.get('/get-transactions', async (req, res) => {
    try {
        const recentTransactions = await transactionModel.find({ category: { $ne: 'Self-Transfer' } })
        .sort({ createdAt: -1 })
        .limit(50).populate('accountId');
        res.status(200).json({ success: true, recentTransactions });
    }catch{
        res.status(500).json({
            success: false,
            message: 'Error getting recent transactions'
        });
    }
})


router.get('/get-income-expense-trends', async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        // Array of the last 6 months for reference
        const monthsArray = [];
        for (let i = 0; i < 6; i++) {
            const date = new Date(sixMonthsAgo);
            date.setMonth(date.getMonth() + i);
            monthsArray.push({
                year: date.getFullYear(),
                month: date.getMonth() + 1
            });
        }

        const trends = await transactionModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo },
                    category: { $nin: ['Self-Transfer', 'building deposit'] }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    income: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", "Credit"] },
                                "$amount",
                                0
                            ]
                        }
                    },
                    expense: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", "Debit"] },
                                "$amount",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            },
            {
                $project: {
                    _id: 0,
                    month: {
                        $concat: [
                            { $arrayElemAt: [["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], "$_id.month"] },
                            " ",
                            { $toString: "$_id.year" }
                        ]
                    },
                    year: "$_id.year",
                    monthNumber: "$_id.month",
                    income: 1,
                    expense: 1
                }
            }
        ]);

        // Map trends to the last 6 months, filling in missing months with zeros
        const trendsMap = monthsArray.map(({ year, month }) => {
            const trend = trends.find(t => t.year === year && t.monthNumber === month) || {};
            return {
                month: `${["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month]}`,
                income: (trend.income || 0).toFixed(2),
                expense: (trend.expense || 0).toFixed(2)
                
            };
        });

        res.status(200).json({ success: true, trends: trendsMap });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting donation and expense trends'
        });
    }
});

router.get('/get-expense-categories', async (req, res) => {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const today = new Date();
  
      const result = await transactionModel.aggregate([
        {
          $match: {
            date: { $gte: startOfMonth, $lte: today },
            $or: [
              { type: 'Credit', category: 'Kudi collection' },
              { type: 'Debit', category: 'Salary' },
              { type: 'Debit', category: 'Other Expenses' },
              { type: 'Credit', category: 'Rent' },
              { type: 'Credit', category: 'Donation' },
            ]
          }
        },
        {
          $group: {
            _id: { type: "$type", category: "$category" },
            totalAmount: { $sum: "$amount" }
          }
        }
      ]);
  
      const response = [
        { asset: "Kudi Collection", amount: result.find(r => r._id.type === 'Credit' && r._id.category === 'Kudi collection')?.totalAmount || 0, fill: '#8884d8' },
        { asset: "Salary", amount: result.find(r => r._id.type === 'Debit' && r._id.category === 'Salary')?.totalAmount || 0, fill: '#82ca9d' },
        { asset: "Rent", amount: result.find(r => r._id.type === 'Credit' && r._id.category === 'Rent')?.totalAmount || 0, fill: '#0088FE' },
        { asset: "Donation", amount: result.find(r => r._id.type === 'Credit' && r._id.category === 'Donation')?.totalAmount || 0, fill: '#dba054' },
        { asset: "Other Expenses", amount: result.find(r => r._id.type === 'Debit' && r._id.category === 'Other Expenses')?.totalAmount || 0, fill: '#FFBB28' },
      ]; 
    
      
  
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });




export default router