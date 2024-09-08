import BankModel from "../model/BankModel.js";
import transactionModel from "../model/transactionModel.js";

export const debitAccount = async (accountId, amount, description, category) => {
    const account = await BankModel.findById(accountId);
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
    
    await transaction.save();
    await account.save();
    
    return transaction;
}

export const creditAccount = async (accountId, amount, description, category) => {
    const account = await BankModel.findById(accountId);
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
    
    await transaction.save();
    await account.save();
    
    return transaction;
}
