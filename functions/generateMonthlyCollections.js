import axios from "axios";
import dotenv from 'dotenv'
import houseModel from "../model/houseModel.js";
import kudiCollection from "../model/kudiCollection.js";
import receiptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "./recieptNumber.js";
import recieptNumberModel from "../model/recieptNumberModel.js";
import logger from "../utils/logger.js";

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
        logger.error('Error retrieving last collection receipt number:', error);
        throw error;
    }
}

export const generateMonthlyCollections = async () => {
    try {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthKey = `${lastMonth.getFullYear()}-${lastMonth.getMonth() + 1}`;

        // Fetch only houses with paymentType 'monthly'
        const houses = await houseModel.find({ paymentType: 'monthly' }).populate('familyHead');

        for (const house of houses) {
            // Skip if the month is already in paidMonths
            if (house.paidMonths.includes(lastMonthKey)) {
                logger.info(`Skipped ${house.name} - Collection for ${lastMonthKey} already paid`);
                continue;
            }

            // Generate a new receipt number
            const lastReceiptNumber = await getLastCollectionReceiptNumber();
            const newReceiptNumber = await NextReceiptNumber(lastReceiptNumber);

            // Create the collection entry
            const collection = new kudiCollection({
                amount: house.collectionAmount,
                date: new Date(),
                description: `Monthly Kudi collection of ${house.collectionAmount} for ${house.familyHead?.name || 'unknown'} from ${house.name} house for the month of ${lastMonth.getFullYear()} - ${lastMonth.toLocaleString('default', { month: 'long' })}.`,
                category: {
                    name: 'Kudi collection',
                    description: `Monthly collection for ${house.familyHead?.name || 'the house'}`,
                },
                collectionMonth: `${lastMonth.getFullYear()} - ${lastMonth.toLocaleString('default', { month: 'long' })}`,
                memberId: house.familyHead?._id,
                houseId: house._id,
                status: 'Unpaid',
                receiptNumber: newReceiptNumber,
            });

            // Update the receipt number tracker
            const updateReceiptNumber = await recieptNumberModel.findOne();
            if (updateReceiptNumber) {
                updateReceiptNumber.collectionReceiptNumber.lastNumber = newReceiptNumber;
                await updateReceiptNumber.save();
            }

            // Save the collection
            await collection.save();

            // Mark the month as paid
            house.paidMonths.push(lastMonthKey);
            await house.save();

            // Send a WhatsApp notification
            await sendWhatsAppMessage(house, lastMonth.toLocaleString('default', { month: 'long' }));

            // Wait before processing the next house
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        logger.info('Monthly collections created for all houses with paymentType "monthly"');
    } catch (error) {
        logger.error('Error creating monthly collections:', error);
    }
};


const sendWhatsAppMessage = async (house,month) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `${house.familyHead.whatsappNumber}`,
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
                                { type: 'text', text: house.number },
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
        logger.info('WhatsApp message sent successfully:', response.data);
    } catch (error) {
        logger.error('Error in sending WhatsApp message:', error.response);
    }
};

export const sendWhatsAppMessageFunction = async (collection) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `${collection.memberId.whatsappNumber}`,
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
                                    text: `${collection.collectionMonth}`
                                },
                                {
                                    type: 'text',
                                    text: `${collection.amount}`
                                },
                                {
                                    type: 'text',
                                    text: `${collection.kudiCollectionType}`
                                },
                            ]
                        },
                        {
                            type: 'button',
                            sub_type: 'url',
                            index: '0',
                            parameters: [
                                { type: 'text', text: `${collection.memberId._id}` }
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
        logger.info('WhatsApp message sent successfully:', response.data.messages);

    } catch (error) {
        logger.error(error.response.data)
    }
};


