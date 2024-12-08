import express  from "express";
import BankModel from "../model/BankModel.js";
import transactionModel from "../model/transactionModel.js";
import mongoose from "mongoose";
const router=express.Router()



router.post('/create', async (req, res) => {
  const { name, holderName, accountNumber, ifscCode, balance, accountType } = req.body;
console.log('start')
  try {
    // Input validation
    if (!name || !holderName || !accountType) {
      return res.status(400).send({ success: false, message: 'Missing required fields' });
    }

    // Validate account type
    if (!['bank', 'cash'].includes(accountType)) {
      return res.status(400).send({ success: false, message: 'Invalid account type' });
    }
  
    const existingAccounts = await BankModel.countDocuments();

    // Create a new bank or cash account document
    const newAccount = new BankModel({
      name,
      holderName,
      accountNumber: accountType === 'bank' ? accountNumber : undefined, 
      ifscCode: accountType === 'bank' ? ifscCode : undefined,
      balance: balance,
      accountType,
      primary: existingAccounts === 0, 
    });

    // Save the account document to the database
    const savedAccount = await newAccount.save();
console.log('end')
    // Send a success response
    res.status(201).send({
      success: true,
      message: 'Account created successfully',
      account: savedAccount,
    });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).send({
      success: false,
      message: 'Server error while creating account',
      error: error.message,
    });
  }
});


  router.post('/set-primary', async (req, res) => {
    const { accountId } = req.body;
  
    try {
      // Validate input
      if (!accountId) {
        return res.status(400).send({ success: false, message: 'Account ID is required' });
      }
  
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
  
      try {
        // Set all accounts' primary field to false
        await BankModel.updateMany({}, { primary: false }, { session });
  
        // Set the specified account's primary field to true
        const updatedAccount = await BankModel.findByIdAndUpdate(accountId, { primary: true }, { new: true, session });
  
        // Commit the transaction
        await session.commitTransaction();
        session.endSession();
  
        // Check if the account was successfully updated
        if (!updatedAccount) {
          return res.status(404).send({ success: false, message: 'Account not found' });
        }
  
        // Send a success response
        res.status(200).send({ success: true, message: 'Primary account set successfully', account: updatedAccount });
      } catch (error) {
        // Rollback the transaction in case of an error
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } catch (error) {
      // Handle any errors that occur
      res.status(500).send({ success: false, message: 'Server Error', error: error.message });
    }
  });
  
  
router.put('/edit/:id', async (req, res) => {
    const { id } = req.params;
    const { name, holderName, accountNumber, ifscCode, balance, accountType } = req.body;

    try {

        // Find the existing account by ID
        const existingAccount = await BankModel.findById(id);
        if (!existingAccount) {
            return res.status(404).send({ success: false, message: 'Account not found' });
        }

        // Update the account fields
        existingAccount.name = name;
        existingAccount.holderName = holderName;
        existingAccount.balance = balance;
        existingAccount.accountType = accountType;

        if (accountType === 'bank') {
            existingAccount.accountNumber = accountNumber;
            existingAccount.ifscCode = ifscCode;
        } else {
            existingAccount.accountNumber = undefined;
            existingAccount.ifscCode = undefined;
        }

        // Save the updated account document to the database
        const updatedAccount = await existingAccount.save();

        // Send a success response
        res.status(200).send({ success: true, account: updatedAccount });
    } catch (error) {
        // Handle any errors that occur
        res.status(500).send({ success: false, message: 'Server Error', error: error.message });
    }
});

router.get('/get-all', async (req, res) => {
  try {
      // Fetch all bank or cash accounts
      const accounts = await BankModel.find().sort({
          createdAt: -1,
      });

      // Send a success response
      res.status(200).send({ success: true, accounts });
  } catch (error) {
      // Handle any errors that occur
      res.status(500).send({ success: false, message: 'Server Error',
          error: error.message,
      });
  }
})

router.get('/get', async (req, res) => {
  try {
      // Query the database for bank or cash accounts
      const accounts = await BankModel.find({ accountType: { $in: ['bank', 'cash'] } })
          .sort({ createdAt: -1 })
          .limit(100); // Limit the number of results to prevent overloading

      // If no accounts are found, return an empty array
      if (!accounts || accounts.length === 0) {
          return res.status(404).send({
              success: false,
              message: 'No bank or cash accounts found.',
          });
      }

      // Send a success response with the fetched accounts
      res.status(200).send({
          success: true,
          data: accounts,
      });
  } catch (error) {
      res.status(500).send({
          success: false,
          message: 'An error occurred while fetching accounts. Please try again later.',
      });
  }
});

router.post('/inter-account-transfer', async (req, res) => {
  const { fromAccount, toAccount, amount } = req.body;

  // Ensure fromAccount and toAccount are not the same
  if (!fromAccount || !toAccount || !amount || amount <= 0) {
    return res.status(400).send({ success: false, message: 'Invalid input' });
  }
  const parsedAmount = Number(amount);

  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).send({ success: false, message: 'Invalid amount' });
  }
  if (fromAccount._id === toAccount._id) {
    return res.status(400).send({ success: false, message: 'From and to accounts cannot be the same.' });
  }

  const session = await BankModel.startSession(); // Start a new session

  try {
      session.startTransaction(); // Begin the transaction

      const debitAccount = await BankModel.findById(fromAccount._id).session(session);

      if (debitAccount.balance < parsedAmount) {
        await session.abortTransaction();
        return res.status(400).send({ success: false, message: 'Insufficient funds.' });
      }

     const debitTransaction = new transactionModel({
      type: 'Debit',
      amount: parsedAmount,
      accountId: fromAccount._id,
      description: `Account Deposited from ${fromAccount.name} to ${toAccount.name}`,
      category: 'Self-Transfer',
      openingBalance: Number(debitAccount.balance),
      closingBalance: Number(debitAccount.balance) - parsedAmount
    });
    await debitTransaction.save({ session });

    await BankModel.findByIdAndUpdate(fromAccount._id, { $inc: { balance: -parsedAmount } }, { session });

    // Fetch the toAccount
    const creditAccount = await BankModel.findById(toAccount._id).session(session);

    if (!creditAccount) {
      throw new Error('To account not found');
    }

    // Create credit transaction
    const creditTransaction = new transactionModel({
      type: 'Credit',
      amount: parsedAmount,
      accountId: toAccount._id,
      description: `Amount Deposit from ${fromAccount.name} to ${toAccount.name}`,
      category: 'Self-Transfer',
      openingBalance: Number(creditAccount.balance),
      closingBalance: Number(creditAccount.balance) + parsedAmount,
    });
    await creditTransaction.save({ session });

    // Credit the toAccount
    await BankModel.findByIdAndUpdate(toAccount._id, { $inc: { balance: parsedAmount } }, { session });

    // Commit the transaction
    await session.commitTransaction();

    // Send success response
    res.status(200).send({ 
      success: true, 
      message: 'Transfer successful', 
      transactions: { debitTransactionId: debitTransaction._id, creditTransactionId: creditTransaction._id } 
    });
  } catch (error) {
    await session.abortTransaction(); // Rollback transaction in case of any error
    res.status(500).send({ success: false, message: 'Transfer failed', error: error.message });
  } finally {
    session.endSession();  // Ensure session is always ended
  }
});




export default router