import express  from "express";
import BankModel from "../model/BankModel.js";
import transactionModel from "../model/transactionModel.js";
import logger from "../utils/logger.js";
const router=express.Router()


router.get('/get-assets', async(req, res) => {
    try{
        // Fetch all assets from the database
        const assets = await BankModel.find({ accountType: { $in: ['bank', 'cash'] } });

        const totalBalance = assets.reduce((sum, asset) => sum + asset.balance, 0).toFixed(2);
        res.status(200).json({ success: true, asset:totalBalance });
    }catch(error){
        logger.error(error)
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
        logger.error('Error fetching expenses',error)
        res.status(500).json({
            error,
            success: false,
            message: 'Error getting expenses'
        });
    }
});

const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0; // Handle division by zero
    return ((current - previous) / previous) * 100; // Fixed the formula
};

router.get('/get-incomes', async (req, res) => {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Current month range (up to current moment)
        const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
        startOfCurrentMonth.setHours(0, 0, 0, 0);
        const endOfCurrentMonth = new Date(now); // Use current time

        // Last month range (full month)
        const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
        startOfLastMonth.setHours(0, 0, 0, 0);
        const endOfLastMonth = new Date(currentYear, currentMonth, 0);
        endOfLastMonth.setHours(23, 59, 59, 999);

        // Using consistent field name - change to createdAt if needed
        const [current, last] = await Promise.all([
            transactionModel.aggregate([
                { 
                    $match: { 
                        type: 'Credit',
                        category: { $nin: ['Self-Transfer', 'building deposit'] },
                        date: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            transactionModel.aggregate([
                { 
                    $match: { 
                        type: 'Credit',
                        category: { $nin: ['Self-Transfer', 'building deposit'] },
                        date: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const currentTotal = current[0]?.total || 0;
        const lastTotal = last[0]?.total || 0;

        res.status(200).json({
            success: true,
            currentMonthTotal: currentTotal.toFixed(2),
            lastMonthTotal: lastTotal.toFixed(2),
            percentageChange: calculatePercentageChange(currentTotal, lastTotal).toFixed(2),
            meta: {
                currentMonthRange: {
                    start: startOfCurrentMonth.toISOString(),
                    end: endOfCurrentMonth.toISOString()
                },
                lastMonthRange: {
                    start: startOfLastMonth.toISOString(),
                    end: endOfLastMonth.toISOString()
                }
            }
        });
    } catch (error) {
        logger.error(`Error in /get-incomes: ${JSON.stringify(error.message)}`);
        res.status(500).json({
            success: false,
            message: 'Error getting income data'
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
        logger.error(error)
        res.status(500).json({
            success: false,
            message: 'Error getting recent transactions'
        });
    }
})


router.get('/get-income-expense-trends', async (req, res) => {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Create month array first to ensure consistent date ranges
        const months = Array.from({ length: 6 }, (_, i) => {
            const monthDate = new Date(currentYear, currentMonth - 5 + i, 1);
            let monthEnd;
            
            // For current month, use current time instead of month end
            if (i === 5) {
                monthEnd = new Date(now);
            } else {
                monthEnd = new Date(currentYear, currentMonth - 4 + i, 0);
                monthEnd.setHours(23, 59, 59, 999);
            }

            return {
                year: monthDate.getFullYear(),
                month: monthDate.getMonth() + 1,
                name: monthDate.toLocaleString('default', { month: 'long' }),
                start: new Date(monthDate),
                end: monthEnd,
                isCurrent: i === 5
            };
        });

        // Get all data in single query for efficiency
        const trends = await transactionModel.aggregate([
            {
                $match: {
                    date: {
                        $gte: months[0].start,
                        $lte: months[5].end
                    },
                    category: { $nin: ['Self-Transfer', 'building deposit'] }
                }
            },
            {
                $project: {
                    year: { $year: "$date" },
                    month: { $month: "$date" },
                    amount: 1,
                    type: 1
                }
            },
            {
                $group: {
                    _id: {
                        year: "$year",
                        month: "$month"
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
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Map results to months
        const result = months.map(m => {
            const data = trends.find(t => 
                t._id.year === m.year && 
                t._id.month === m.month
            ) || { income: 0, expense: 0, count: 0 };

            return {
                month: m.name,
                year: m.year,
                monthNumber: m.month,
                income: parseFloat(data.income.toFixed(2)),
                expense: parseFloat(data.expense.toFixed(2)),
                net: parseFloat((data.income - data.expense).toFixed(2)),
                transactionCount: data.count,
                isCurrentMonth: m.isCurrent,
                isPartialData: m.isCurrent,
                timeRange: {
                    start: m.start.toISOString(),
                    end: m.end.toISOString()
                }
            };
        });

        res.status(200).json({
            success: true,
            trends: result,
            timeRange: {
                start: months[0].start.toISOString(),
                end: months[5].end.toISOString()
            }
        });
    } catch (error) {
        logger.error(`Error in /get-income-expense-trends: ${JSON.stringify(error.message)}`);
        res.status(500).json({
            success: false,
            message: 'Error getting trends'
        });
    }
});

router.get('/get-expense-categories', async (req, res) => {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Current month range (consistent with other endpoints)
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(now); // Use current time

        const result = await transactionModel.aggregate([
            {
                $match: {
                    date: { 
                        $gte: startOfMonth, 
                        $lte: endOfMonth 
                    },
                    $or: [
                        { type: 'Credit', category: 'Kudi collection' },
                        { type: 'Debit', category: 'Salary' },
                        { type: 'Debit', category: 'Other Expenses' },
                        { type: 'Credit', category: 'Rent' },
                        { type: 'Credit', category: 'Donation' }
                    ]
                }
            },
            {
                $group: {
                    _id: { 
                        type: "$type", 
                        category: "$category" 
                    },
                    totalAmount: { $sum: "$amount" },
                    transactionCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    type: "$_id.type",
                    category: "$_id.category",
                    totalAmount: 1,
                    transactionCount: 1
                }
            }
        ]);

        // Create consistent response format
        const response =  [
                { 
                    asset: "Kudi Collection", 
                    amount: result.find(r => r.type === 'Credit' && r.category === 'Kudi collection')?.totalAmount || 0, 
                    count: result.find(r => r.type === 'Credit' && r.category === 'Kudi collection')?.transactionCount || 0,
                    fill: '#8884d8' 
                },
                { 
                    asset: "Salary", 
                    amount: result.find(r => r.type === 'Debit' && r.category === 'Salary')?.totalAmount || 0,
                    count: result.find(r => r.type === 'Debit' && r.category === 'Salary')?.transactionCount || 0,
                    fill: '#82ca9d' 
                },
                { 
                    asset: "Rent", 
                    amount: result.find(r => r.type === 'Credit' && r.category === 'Rent')?.totalAmount || 0,
                    count: result.find(r => r.type === 'Credit' && r.category === 'Rent')?.transactionCount || 0,
                    fill: '#0088FE' 
                },
                { 
                    asset: "Donation", 
                    amount: result.find(r => r.type === 'Credit' && r.category === 'Donation')?.totalAmount || 0,
                    count: result.find(r => r.type === 'Credit' && r.category === 'Donation')?.transactionCount || 0,
                    fill: '#dba054' 
                },
                { 
                    asset: "Other Expenses", 
                    amount: result.find(r => r.type === 'Debit' && r.category === 'Other Expenses')?.totalAmount || 0,
                    count: result.find(r => r.type === 'Debit' && r.category === 'Other Expenses')?.transactionCount || 0,
                    fill: '#FFBB28' 
                }
            ]

        res.status(200).json(response);
    } catch (error) {
        logger.error(`Error in /get-expense-categories: ${JSON.stringify(error.message)}`);
        res.status(500).json({
            success: false,
            message: 'Error getting expense categories',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});




export default router