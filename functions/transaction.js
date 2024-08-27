import BankModel from "../model/BankModel.js";
import transactionModel from "../model/transactionModel.js";


export const debitAccount= async(accountId, amount, description,category)=> {
    
    const account = await BankModel.findById(accountId);
    if (!account) throw new Error('Account not found');
    
    if (account.balance < amount) throw new Error('Insufficient funds');
    
    const transaction = new transactionModel({
      type: 'Debit',
      amount,
      description,
      accountId,
      category: category, // Or any relevant category
    });
    
    account.balance -= amount;
    await transaction.save();
    await account.save();
    
    return transaction;
  }

  export const creditAccount= async(accountId, amount, description,category)=> {
    const account = await BankModel.findById(accountId);
    if (!account) throw new Error('Account not found');
    
    const transaction = new transactionModel({
      type: 'Credit',
      amount,
      description,
      accountId,
      category: category,
    });
    
    account.balance += amount;
    await transaction.save();
    await account.save();
    
    return transaction;
  }