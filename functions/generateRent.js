import axios from "axios";
import BankModel from "../model/BankModel.js";
import buildingModel from "../model/buildingModel.js";
import dotenv from 'dotenv'

dotenv.config({ path: './.env' })
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

// Helper function to introduce a delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const collectRent = async () => {
  try {
    const buildings = await buildingModel.find();

    for (const building of buildings) {
      for (const room of building.rooms) {
        const activeContract = room.contractHistory.find((contract) => {
          const currentDate = new Date();
          const contractEndDate = new Date(contract.to);

          return contract.status === 'active' && contractEndDate >= currentDate;
        });

        if (activeContract) {
          const today = new Date();
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1); 
          const period = `${lastMonth.toLocaleString('default', { month: 'long' })} ${lastMonth.getFullYear()}`;

          const existingCollection = activeContract.rentCollection.find(
            (collection) => collection.period === period
          );

          if (existingCollection) {
            continue;
          }

          let amountDue;

          // Check if firstRent needs to be applied
          if (activeContract.firstRent > 0) {
            // Deduct firstRent from the amount due if it hasn't been applied yet
            amountDue = activeContract.firstRent;
            // Reset firstRent after applying it
            activeContract.firstRent = 0;
          } else {
            amountDue = activeContract.rent;
          }

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
            period: period,
            amount: amountDue,
            status: amountDue === 0 ? 'Paid' : 'Pending',
            paymentDate: amountDue === 0 ? today : null, // Mark as paid if fully covered by advance or firstRent
          };

          activeContract.rentCollection.push(rentCollection);

          // Notify tenant
          // await sendWhatsapp(rentCollection, activeContract.tenant,room,building);

          // Add a 2-second delay between each rent collection
          await delay(2000);
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

const sendWhatsapp = async (rentCollection, tenant,room,building) => {
  try {
    console.log(rentCollection)
    console.log(tenant)
    const response = await axios.post(
        WHATSAPP_API_URL,
        {
            messaging_product: 'whatsapp',
            to: `91${tenant.number}`,
            type: 'template',
            template: {
                name: 'rent_collection',
                language: {
                    code: 'ml' 
                },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: tenant.name },     
                            { type: 'text', text: room.roomNumber },   
                            { type: 'text', text: rentCollection.period},
                            { type: 'text', text: rentCollection.amount},          
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [
                            { type: 'text', text: `${building._id}/${room._id}` }  
                        ]
                    }
                ]
            }
        },
        {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );
    console.log('WhatsApp message sent successfully:', response.data);
} catch (error) {
    console.error('Error sending WhatsApp message:', error);
}
};


