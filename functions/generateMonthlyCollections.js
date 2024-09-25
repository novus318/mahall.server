import axios from "axios";
import dotenv from 'dotenv'
import BankModel from "../model/BankModel.js";
import houseModel from "../model/houseModel.js";
import kudiCollection from "../model/kudiCollection.js";
import receiptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "./recieptNumber.js";
import recieptNumberModel from "../model/recieptNumberModel.js";

dotenv.config({ path: './.env' })
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

async function getLastCollectionReceiptNumber() {
    try {
        const receiptNumber = await receiptNumberModel.findOne({}, 'collectionReceiptNumber.lastNumber');
        if (receiptNumber && receiptNumber.collectionReceiptNumber) {
            return receiptNumber.collectionReceiptNumber.lastNumber;
        } else {
            throw new Error('No receipt number found');
        }
    } catch (error) {
        console.error('Error retrieving last collection receipt number:', error);
        throw error;
    }
}

export const generateMonthlyCollections = async () => {
    try {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthName = lastMonth.toLocaleString('default', { month: 'long' });
        const houses = await houseModel.find().populate('familyHead');

        for (const house of houses) {
            const lastRecieptNumber=await getLastCollectionReceiptNumber()
const newRecieptNumber = await NextReceiptNumber(lastRecieptNumber);
            const collection = new kudiCollection({
                amount: house.collectionAmount,
                date: new Date(),
                description: `Monthly Kudi collection of ${house.collectionAmount} for ${house.familyHead.name} from ${house.name} house for the month of ${lastMonthName}.`,
                category: {
                    name: 'Kudi collection',
                    description: `Monthly collection for ${house.familyHead.name || 'the house'}`,
                },
                memberId: house.familyHead._id,
                houseId: house._id, 
                status: 'Unpaid',
                receiptNumber:newRecieptNumber
            });
            const UptdateReceiptNumber = await recieptNumberModel.findOne();
            if (UptdateReceiptNumber) {
                UptdateReceiptNumber.collectionReceiptNumber.lastNumber = newRecieptNumber;
                await UptdateReceiptNumber.save();
            }
            await collection.save();
            // await sendWhatsAppMessage(
            //     house,
            //     lastMonthName
            // );
          
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
                to: `+91${house.familyHead.whatsappNumber}`,
                type: 'template',
                template: {
                    name: 'collection',
                    language: {
                        code: 'ml' 
                    },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: house.familyHead.name }, 
                                { type: 'text', text: month },   
                                { type: 'text', text: house.collectionAmount },
                            ]
                        },
                        {
                            type: 'button',
                            sub_type: 'url',
                            index: '0',
                            parameters: [
                                { type: 'text', text: `${house.familyHead._id}` }  
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
                to: `+91${collection.memberId.whatsappNumber}`,
                type: 'template',
                template: {
                    name: 'collection_reciept',
                    language: {
                        code: 'ml' 
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
                            ]
                        },
                        {
                            type: 'button',
                            sub_type: 'url',
                            index: '0',
                            parameters: [
                                { type: 'text', text: `${collection.memberId._id}` }         // {{1}} -> paymentUrl
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
        console.log(error.response.data)
    }
};


