import express  from "express";
import transactionModel from "../model/transactionModel.js";
import BankModel from "../model/BankModel.js";
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

  
  router.get('/recent/transactions', async (req, res) => {
    try {
      const transactions = await transactionModel.find().sort({ createdAt: -1 }).limit(250).populate('accountId');
      
      res.status(200).send({ success: true, data: transactions });
    } catch (error) {
      res.status(500).send({ success: false, message: 'Failed to retrieve transactions', error: error.message });
    }
  })
  router.get('/recent/transactions/byDate', async (req, res) => {
    try {
      const { fromDate, toDate, accountName } = req.query;
  
      if (!fromDate || !toDate) {
        return res.status(400).send({ success: false, message: 'Please provide both fromDate and toDate' });
      }
  
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
  
      // Initialize the query object
      const query = {
        date: {
          $gte: from,
          $lte: to,
        },
      };
  
      // If an account name is provided, look up the accountId
      if (accountName) {
        const account = await BankModel.findOne({ name: accountName });
        if (account) {
          query.accountId = account._id; // Filter by accountId
        } else {
          return res.status(404).send({ success: false, message: 'Account not found' });
        }
      }
  
      // Fetch all transactions within the date range and account filter
      const transactions = await transactionModel.find(query)
        .sort({ date: 1 })
        .populate('accountId');
  
      if (transactions.length === 0) {
        return res.status(404).send({ success: false, message: 'No transactions found in the specified date range' });
      }
  
      const openingAccountsMap = new Map();
      const closingAccountsMap = new Map();
  
      // Process transactions to map opening and closing balances for each account
      transactions.forEach(transaction => {
        const accountId = transaction.accountId._id.toString();
        const accountName = transaction.accountId.name;
  
        // Set opening balance (only if it's the first occurrence of this account)
        if (!openingAccountsMap.has(accountId)) {
          openingAccountsMap.set(accountId, {
            accountId,
            accountName,
            openingBalance: transaction.openingBalance,
          });
        }
  
        // Always set/update the closing balance with the latest transaction's closing balance
        closingAccountsMap.set(accountId, {
          accountId,
          accountName,
          closingBalance: transaction.closingBalance,
        });
      });
  
      // Format transactions for response
      const allTransactions = transactions.map(transaction => ({
        date: transaction.date,
        description: transaction.description,
        type: transaction.type,
        category: transaction.category,
        accountId: transaction.accountId._id,
        accountName: transaction.accountId.name,
        amount: transaction.amount,
        Balance: transaction.closingBalance,
        reference: transaction?.reference || null,
      }));
  
      // Convert maps to arrays
      const OpeningAccounts = Array.from(openingAccountsMap.values());
      const ClosingAccounts = Array.from(closingAccountsMap.values());
  
      // Build the final statement
      const statement = {
        from: fromDate,
        to: toDate,
        transactions: allTransactions,
        OpeningAccounts,
        ClosingAccounts,
      };
  
      res.status(200).send({ success: true, statement, message: '' });
    } catch (error) {
      console.log(error)
      res.status(500).send({ success: false, message: 'Failed to retrieve transactions', error: error.message });
    }
  });
   


export default router