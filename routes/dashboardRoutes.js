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

router.get('/get-donations', async (req, res) => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date();
        endOfMonth.setHours(23, 59, 59, 999);

        const totalDonations = await transactionModel.aggregate([
            {
                $match: {
                    category: 'Donation',
                    createdAt: {
                        $gte: startOfMonth,
                        $lte: endOfMonth
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCredit: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "Credit"] }, "$amount", 0]
                        }
                    },
                    totalDebit: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "Debit"] }, "$amount", 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalDonations: { $subtract: ["$totalCredit", "$totalDebit"] }
                }
            }
        ]);

        const total = totalDonations.length > 0 ? totalDonations[0].totalDonations : 0;

        res.status(200).json({ success: true, totalDonations: total });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting total donations'
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


router.get('/get-donation-expense-trends', async (req, res) => {
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
                    category: { $ne: "Self-Transfer" }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    donation: {
                        $sum: {
                            $cond: [
                                { $eq: ["$category", "Donation"] },
                                {
                                    $cond: [
                                        { $eq: ["$type", "Debit"] }, 
                                        { $multiply: ["$amount", -1] }, 
                                        "$amount"
                                    ]
                                },
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
                    donation: 1,
                    expense: 1
                }
            }
        ]);

        // Map trends to the last 6 months, filling in missing months with zeros
        const trendsMap = monthsArray.map(({ year, month }) => {
            const trend = trends.find(t => t.year === year && t.monthNumber === month) || {};
            return {
                month: `${["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month]}`,
                donation: trend.donation || 0,
                expense: trend.expense || 0
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
  
      const response = {
        KudiCollection: result.find(r => r._id.type === 'Credit' && r._id.category === 'Kudi collection')?.totalAmount || 0,
        Salary: result.find(r => r._id.type === 'Debit' && r._id.category === 'Salary')?.totalAmount || 0,
        Rent: result.find(r => r._id.type === 'Credit' && r._id.category === 'Rent')?.totalAmount || 0,
        Donation: result.find(r => r._id.type === 'Credit' && r._id.category === 'Donation')?.totalAmount || 0,
        OtherExpenses: result.find(r => r._id.type === 'Debit' && r._id.category === 'Other Expenses')?.totalAmount || 0,
      };
      
  
      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });


export default router