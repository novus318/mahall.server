import axios from "axios";
import dotenv from 'dotenv'
import BankModel from "../model/BankModel.js";
import houseModel from "../model/houseModel.js";
import kudiCollection from "../model/kudiCollection.js";

dotenv.config({ path: './.env' })
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;


export const generateMonthlyCollections = async () => {
    try {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthName = lastMonth.toLocaleString('default', { month: 'long' });
        const houses = await houseModel.find().populate('familyHead'); // Fetch all houses and populate the familyHead field
        const primaryBank = await BankModel.findOne({ primary: true });
        if (!primaryBank) {
            throw new Error('Primary bank account not found');
        }
        for (const house of houses) {
            const collection = new kudiCollection({
                amount: house.collectionAmount,
                date: new Date(),
                description: `Monthly Kudi collection of ${house.collectionAmount} for ${house.familyHead.name} from ${house.name} house for the month of ${lastMonthName}.`,
                category: {
                    name: 'Kudi collection',
                    description: `Monthly collection for ${house.familyHead.name || 'the house'}`,
                },
                accountId:primaryBank._id,
                memberId: house.familyHead._id,
                houseId: house._id, 
                status: 'Unpaid',
            });

            await collection.save();
            await sendWhatsAppMessage(
                house,
                lastMonthName
            );
            // Wait for 30 seconds before creating the next collection
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        console.log('Monthly collections created for all houses');
    } catch (error) {
        console.error('Error creating monthly collections:', error);
    }
};

const sendWhatsAppMessage = async (house,month) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `+91${house.familyHead.mobile}`,
                type: 'template',
                template: {
                    name: 'collection',
                    language: {
                        code: 'en' 
                    },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: house.familyHead.name },      // {{1}} -> recipientName
                                { type: 'text', text: house.collectionAmount },   // {{2}} -> collectionAmount
                                { type: 'text', text: house.name },          // {{3}} -> houseName
                                { type: 'text', text: month },              // {{4}} -> month
                            ]
                        },
                        {
                            type: 'button',
                            sub_type: 'url',
                            index: '0',
                            parameters: [
                                { type: 'text', text: `${house.familyHead._id}` }         // {{1}} -> paymentUrl
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
        console.error('Error sending WhatsApp message:', error.response);
    }
};

export const sendWhatsAppMessageFunction = async (collection) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `+91${collection.memberId.mobile}`,
                type: 'template',
                template: {
                    name: 'collection_reciept',
                    language: {
                        code: 'en' 
                    },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                {
                                    type: 'text',
                                    text: `${collection.memberId.name}`
                                },
                                {
                                    type: 'text',
                                    text: `${collection.amount}`
                                },
                                {
                                    type: 'text',
                                    text: `https://mahall.vercel.app/payment-reciept/${collection.memberId._id}`
                                },
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
        console.log('WhatsApp message sent successfully:', response.data.messages);

    } catch (error) {
        
    }
};
