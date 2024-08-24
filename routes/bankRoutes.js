import express  from "express";
import BankModel from "../model/BankModel.js";
import transactionModel from "../model/transactionModel.js";
import mongoose from "mongoose";
const router=express.Router()



router.post('/create', async (req, res) => {
    const { name, holderName, accountNumber, ifscCode, balance, accountType } = req.body;

    try {
        // Validate input
        if (!name || !holderName || !accountType) {
            return res.status(400).send({ success: false, message: 'Missing required fields' });
        }

        // Check if accountType is valid
        if (!['bank', 'cash'].includes(accountType)) {
            return res.status(400).send({ success: false, message: 'Invalid account type' });
        }

        // Create a new bank or cash account document
        const newAccount = new BankModel({
            name,
            holderName,
            accountNumber: accountType === 'bank' ? accountNumber : undefined, // Set to undefined for cash accounts
            ifscCode: accountType === 'bank' ? ifscCode : undefined, // Set to undefined for cash accounts
            balance,
            accountType
        });

        // Save the account document to the database
        const savedAccount = await newAccount.save();

        // Send a success response
        res.status(201).send({ success: true, account: savedAccount });
    } catch (error) {
        // Handle any errors that occur
        res.status(500).send({ success: false, message: 'Server Error',
            error: error.message,
         });
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


router.get('/get', async (req, res) => {
    try {
        // Fetch all bank or cash accounts
        const accounts = await BankModel.find({ accountType: { $in: ['bank', 'cash'] } }).sort({
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

router.post('/inter-account-transfer', async (req, res) => {
    const { fromAccount, toAccount, amount } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const debitTransaction = new transactionModel({
            type: 'Debit',
            amount,
            accountId: fromAccount._id,
            description: `Account tranfer to ${toAccount.name}`,
            category: 'Self-Transfer',
          });
          await debitTransaction.save({ session });
          await BankModel.findByIdAndUpdate(fromAccount._id, { $inc: { balance: -amount } }, { session });

          const creditTransaction = new transactionModel({
            type: 'Credit',
            amount,
            accountId: toAccount._id,
            description:`Amount transfer from ${fromAccount.name} to ${toAccount.name}`,
            category: 'Self-Transfer',
          });
          await creditTransaction.save({ session });

          await BankModel.findByIdAndUpdate(toAccount._id, { $inc: { balance: +amount } }, { session });

          await session.commitTransaction();
          session.endSession();
          res.status(200).send({ success: true, message: 'Transfer successful' });
}catch{
    await session.abortTransaction();
    session.endSession();
    res.status(500).send({ success: false, message: 'Transfer failed' });
}
})



export default router