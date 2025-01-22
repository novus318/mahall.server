import axios from "axios";
import dotenv from 'dotenv'
import houseModel from "../model/houseModel.js";
import kudiCollection from "../model/kudiCollection.js";
import { NextReceiptNumber } from "./recieptNumber.js";
import recieptNumberModel from "../model/recieptNumberModel.js";
import logger from "../utils/logger.js";

async function getLastCollectionReceiptNumber() {
    try {
        const receiptNumber = await recieptNumberModel.findOne({}, 'collectionReceiptNumber.lastNumber');
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


export const generateYearlyCollections = async () => {
    try {
        const currentYear = new Date().getFullYear();
        const currentYearKey = `${currentYear}`;

        // Fetch only houses with paymentType 'yearly'
        const houses = await houseModel.find({ paymentType: 'yearly' }).populate('familyHead');

        for (const house of houses) {
            // Skip if the year is already in paidYears
            if (house.paidYears.includes(currentYearKey)) {
                logger.info(`Skipped ${house.name} - Collection for ${currentYearKey} already paid`);
                continue;
            }

            // Generate a new receipt number
            const lastReceiptNumber = await getLastCollectionReceiptNumber();
            const newReceiptNumber = await NextReceiptNumber(lastReceiptNumber);

            // Calculate the remaining amount for the year
            const remainingAmount = house.collectionAmount * 12;

            // Create the collection entry
            const collection = new kudiCollection({
                amount: remainingAmount,
                date: new Date(),
                description: `Yearly Kudi collection of ${remainingAmount} for ${house.familyHead?.name || 'unknown'} from ${house.name} house for the year ${currentYear}.`,
                category: {
                    name: 'Kudi collection',
                    description: `Yearly collection for ${house.familyHead?.name || 'the house'}`,
                },
                paidYear: currentYearKey,
                memberId: house.familyHead?._id,
                houseId: house._id,
                status: 'Unpaid',
                receiptNumber: newReceiptNumber,
                paymentType: 'yearly',
                totalAmount: remainingAmount,
                paidAmount: 0,
            });

            // Update the receipt number tracker
            const updateReceiptNumber = await recieptNumberModel.findOne();
            if (updateReceiptNumber) {
                updateReceiptNumber.collectionReceiptNumber.lastNumber = newReceiptNumber;
                await updateReceiptNumber.save();
            }

            // Save the collection
            await collection.save();

            house.paidYears.push(currentYearKey);
            await house.save();

            await sendWhatsAppMessage(house, `${currentYear}`);

            // Wait before processing the next house
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        logger.info('Yearly collections created for all houses with paymentType "yearly"');
    } catch (error) {
        logger.error('Error creating yearly collections:', error);
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
                    name: 'yearly_collection',
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