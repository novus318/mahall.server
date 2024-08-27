import BankModel from "../model/BankModel.js";
import buildingModel from "../model/buildingModel.js";


export const collectRent = async () => {
    try {
      const buildings = await buildingModel.find();
      const primaryBank = await BankModel.findOne({ primary: true });
      if (!primaryBank) {
        throw new Error('Primary bank account not found');
      }
  
      const today = new Date();
  
      for (const building of buildings) {
        for (const room of building.rooms) {
          const activeContract = room.contractHistory.find((contract) => {
            const currentDate = new Date();
            const contractEndDate = new Date(contract.to);
          
            return contract.status === 'active' && contractEndDate >= currentDate;
          });
  
          if (activeContract) {
            const today = new Date();
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1); // Get the first day of the previous month
            const period = `${lastMonth.toLocaleString('default', { month: 'long' })} ${lastMonth.getFullYear()}`;
         const existingCollection = activeContract.rentCollection.find(
              (collection) => collection.period === period
            );
  
            // Skip if rent collection already exists for the current period
            if (existingCollection) {
              continue;
            }
  
            let amountDue = activeContract.rent;
  
            // Check if there's an advance payment
            if (activeContract.advancePayment && activeContract.advancePayment > 0) {
              if (activeContract.advancePayment >= amountDue) {
                // Full payment from advance
                activeContract.advancePayment -= amountDue;
                amountDue = 0;
              } else {
                // Partial payment from advance
                amountDue -= activeContract.advancePayment;
                activeContract.advancePayment = 0;
              }
            }
  
            const rentCollection = {
              accountId: primaryBank._id,
              period: period,
              amount: activeContract.rent,
              status: amountDue === 0 ? 'Paid' : 'Pending',
              paymentDate: amountDue === 0 ? today : null, // Mark as paid if fully covered by advance
            };
  
            activeContract.rentCollection.push(rentCollection);
          }
        }
  
        // Save updated building
        await building.save();
      }
  
      console.log("Rent collection completed successfully.");
    } catch (error) {
      console.error("Error collecting rent:", error);
    }
  };
