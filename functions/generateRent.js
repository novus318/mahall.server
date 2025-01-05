import axios from "axios";
import buildingModel from "../model/buildingModel.js";
import dotenv from 'dotenv'
import logger from "../utils/logger.js";

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
          return contract.status === 'active' ;
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

          let amountDue = activeContract.rent;


          const rentCollection = {
            period: period,
            amount: amountDue,
            status: 'Pending',
         };

          activeContract.rentCollection.push(rentCollection);

          // Notify tenant
          await sendWhatsapp(rentCollection, activeContract.tenant,room,building,activeContract);

          // Add a 2-second delay between each rent collection
          await delay(2000);
        }
      }

      // Save updated building
      await building.save(); 
    }

    logger.info("Rent collection completed successfully.");
  } catch (error) {
    logger.error("Error collecting rent:", error);
  }
};

const sendWhatsapp = async (rentCollection, tenant,room,building,contract) => {
  try {
    const response = await axios.post(
        WHATSAPP_API_URL,
        {
            messaging_product: 'whatsapp',
            to: `${tenant.number}`,
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
                            { type: 'text', text: `${tenant.name}` },
                            { type: 'text', text: `${rentCollection.period}`},     
                            { type: 'text', text: `${room.roomNumber}` },   
                            { type: 'text', text: `${rentCollection.amount}`},          
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [
                            { type: 'text', text: `${building._id}/${room._id}/${contract._id}` }  
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
    logger.info('WhatsApp message sent successfully:', response.data);
} catch (error) {
    logger.error('Error sending WhatsApp message:', error);
}
};

export const sendRentConfirmWhatsapp = async (rentCollection, tenant,room,building,contract) => {
  try {
    const response = await axios.post(
        WHATSAPP_API_URL,
        {
            messaging_product: 'whatsapp',
            to: `${tenant.number}`,
            type: 'template',
            template: {
                name: 'rent_receipt',
                language: {
                    code: 'ml' 
                },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: `${tenant.name}` }, 
                            { type: 'text', text: `${rentCollection.period}`},    
                            { type: 'text', text: `${room.roomNumber}` },   
                            { type: 'text', text: `${rentCollection.PaymentAmount}`},          
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [
                            { type: 'text', text: `${building._id}/${room._id}/${contract._id}` }  
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
    logger.info('WhatsApp message sent successfully:', response.data);
} catch (error) {
    logger.error('Error sending WhatsApp message:', error);
}
};


