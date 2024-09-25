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

export const updateDebitTransaction = async (transactionId, newAmount, description, category) => {
  const transaction = await transactionModel.findById(transactionId);
  if (!transaction) throw new Error('Transaction not found');

  const account = await BankModel.findById(transaction.accountId);
  if (!account) throw new Error('Account not found');

  // Reverse the previous transaction (add back the previous amount)
  account.balance += transaction.amount;

  // Check if there are sufficient funds for the new amount
  if (account.balance < newAmount) {
      throw new Error('Insufficient funds for the updated amount');
  }

  // Update account balance with the new amount
  account.balance -= newAmount;

  // Update the transaction details
  transaction.amount = newAmount;
  transaction.description = description;
  transaction.category = category;
  transaction.openingBalance = account.balance + newAmount;  // before the new debit
  transaction.closingBalance = account.balance;  // after the new debit

  // Save the updated account and transaction
  await transaction.save();
  await account.save();

  return transaction;
};

export const updateCreditTransaction = async (transactionId, newAmount, description, category) => {
  const transaction = await transactionModel.findById(transactionId);
  if (!transaction) throw new Error('Transaction not found');

  const account = await BankModel.findById(transaction.accountId);
  if (!account) throw new Error('Account not found');

  // Reverse the previous credit transaction (subtract the previous amount)
  account.balance -= transaction.amount;

  // Update account balance with the new credit amount
  account.balance += newAmount;

  // Update the transaction details
  transaction.amount = newAmount;
  transaction.description = description;
  transaction.category = category;
  transaction.openingBalance = account.balance - newAmount;  // before the new credit
  transaction.closingBalance = account.balance;  // after the new credit

  // Save the updated account and transaction
  await transaction.save();
  await account.save();

  return transaction;
};

export const deleteDebitTransaction = async (transactionId) => {
  const transaction = await transactionModel.findById(transactionId);
  if (!transaction) throw new Error('Transaction not found');

  const account = await BankModel.findById(transaction.accountId);
  if (!account) throw new Error('Account not found');

  // Reverse the previous transaction (add back the transaction amount to the balance)
  account.balance += transaction.amount;

  // Save the updated account
  await account.save();

  // Delete the transaction
  await transactionModel.findByIdAndDelete(transactionId);

  return { success:true , message: 'Transaction deleted successfully', accountBalance: account.balance };
};
export const deleteCreditTransaction = async (transactionId) => {
  const transaction = await transactionModel.findById(transactionId);
  if (!transaction) throw new Error('Transaction not found');

  const account = await BankModel.findById(transaction.accountId);
  if (!account) throw new Error('Account not found');

  // Reverse the previous transaction (add back the transaction amount to the balance)
  account.balance -= transaction.amount;

  // Save the updated account
  await account.save();

  // Delete the transaction
  await transactionModel.findByIdAndDelete(transactionId);

  return { success:true , message: 'Transaction deleted successfully', accountBalance: account.balance };
};

