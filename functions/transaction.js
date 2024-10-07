import mongoose from "mongoose";
import BankModel from "../model/BankModel.js";
import transactionModel from "../model/transactionModel.js";

export const debitAccount = async (accountId, amount, description, category) => {
  // Ensure amount is a number
  amount = Number(amount);

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid amount. Amount must be a positive number');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const account = await BankModel.findById(accountId).session(session);
    if (!account) throw new Error('Account not found');
    
    if (account.balance < amount) throw new Error('Insufficient funds');

    // Calculate opening balance
    const openingBalance = account.balance;
    
    // Perform debit operation
    account.balance -= amount;

    // Create and save the transaction
    const transaction = new transactionModel({
      type: 'Debit',
      amount,
      description,
      accountId,
      category,
      openingBalance,
      closingBalance: account.balance,
    });

    await transaction.save({ session });
    await account.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return transaction;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Transaction failed: ${error.message}`);
  }
};

export const creditAccount = async (accountId, amount, description, category) => {
  // Ensure amount is a number
  amount = Number(amount);

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid amount. Amount must be a positive number');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const account = await BankModel.findById(accountId).session(session);
    if (!account) throw new Error('Account not found');

    // Calculate opening balance
    const openingBalance = account.balance;

    // Perform credit operation
    account.balance += amount;

    // Create and save the transaction
    const transaction = new transactionModel({
      type: 'Credit',
      amount,
      description,
      accountId,
      category,
      openingBalance,
      closingBalance: account.balance,
    });

    await transaction.save({ session });
    await account.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return transaction;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Transaction failed: ${error.message}`);
  }
};

export const updateDebitTransaction = async (transactionId, newAmount, description, category) => {
  // Ensure newAmount is a number
  newAmount = Number(newAmount);

  if (isNaN(newAmount) || newAmount <= 0) {
    throw new Error('Invalid amount. Amount must be a positive number');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the transaction and associated account within the session
    const transaction = await transactionModel.findById(transactionId).session(session);
    if (!transaction) throw new Error('Transaction not found');

    const account = await BankModel.findById(transaction.accountId).session(session);
    if (!account) throw new Error('Account not found');

    // Reverse the previous transaction (add back the previous debit amount)
    account.balance += transaction.amount;

    // Check if there are sufficient funds for the new amount
    if (account.balance < newAmount) {
      throw new Error('Insufficient funds for the updated amount');
    }

    // Update account balance with the new debit amount
    account.balance -= newAmount;

    // Update the transaction details
    transaction.amount = newAmount;
    transaction.description = description;
    transaction.category = category;
    transaction.openingBalance = account.balance + newAmount; // before the new debit
    transaction.closingBalance = account.balance; // after the new debit

    // Save the updated transaction and account
    await transaction.save({ session });
    await account.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return transaction;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Failed to update debit transaction: ${error.message}`);
  }
};

export const updateCreditTransaction = async (transactionId, newAmount, description, category) => {
  // Ensure newAmount is a number
  newAmount = Number(newAmount);

  if (isNaN(newAmount) || newAmount <= 0) {
    throw new Error('Invalid amount. Amount must be a positive number');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the transaction and associated account within the session
    const transaction = await transactionModel.findById(transactionId).session(session);
    if (!transaction) throw new Error('Transaction not found');

    const account = await BankModel.findById(transaction.accountId).session(session);
    if (!account) throw new Error('Account not found');

    // Reverse the previous credit transaction (subtract the previous credit amount)
    account.balance -= transaction.amount;

    // Update account balance with the new credit amount
    account.balance += newAmount;

    // Update the transaction details
    transaction.amount = newAmount;
    transaction.description = description;
    transaction.category = category;
    transaction.openingBalance = account.balance - newAmount; // before the new credit
    transaction.closingBalance = account.balance; // after the new credit

    // Save the updated transaction and account
    await transaction.save({ session });
    await account.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return transaction;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Failed to update credit transaction: ${error.message}`);
  }
};

export const deleteDebitTransaction = async (transactionId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await transactionModel.findById(transactionId).session(session);
    if (!transaction) throw new Error('Transaction not found');

    const account = await BankModel.findById(transaction.accountId).session(session);
    if (!account) throw new Error('Account not found');

    // Ensure the transaction amount is valid
    if (isNaN(transaction.amount) || transaction.amount <= 0) {
      throw new Error('Invalid transaction amount');
    }

    // Reverse the previous debit transaction (add back the transaction amount to the balance)
    account.balance += transaction.amount;

    // Save the updated account
    await account.save({ session });

    // Delete the transaction
    await transactionModel.findByIdAndDelete(transactionId).session(session);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return { success: true, message: 'Transaction deleted successfully', accountBalance: account.balance };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Failed to delete debit transaction: ${error.message}`);
  }
};

export const deleteCreditTransaction = async (transactionId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await transactionModel.findById(transactionId).session(session);
    if (!transaction) throw new Error('Transaction not found');

    const account = await BankModel.findById(transaction.accountId).session(session);
    if (!account) throw new Error('Account not found');

    // Ensure the transaction amount is valid
    if (isNaN(transaction.amount) || transaction.amount <= 0) {
      throw new Error('Invalid transaction amount');
    }

    // Reverse the previous credit transaction (subtract the transaction amount from the balance)
    account.balance -= transaction.amount;

    // Ensure the balance doesn't go negative
    if (account.balance < 0) {
      throw new Error('Account balance cannot be negative after deleting this transaction');
    }

    // Save the updated account
    await account.save({ session });

    // Delete the transaction
    await transactionModel.findByIdAndDelete(transactionId).session(session);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return { success: true, message: 'Transaction deleted successfully', accountBalance: account.balance };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Failed to delete credit transaction: ${error.message}`);
  }
};

