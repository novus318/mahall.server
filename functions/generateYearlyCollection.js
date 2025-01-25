import axios from "axios";
import dotenv from 'dotenv'
import houseModel from "../model/houseModel.js";
import kudiCollection from "../model/kudiCollection.js";
import { NextReceiptNumber } from "./recieptNumber.js";
import recieptNumberModel from "../model/recieptNumberModel.js";
import logger from "../utils/logger.js";


dotenv.config({ path: './.env' })
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

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
        const houses = await houseModel.find({
            paymentType: 'yearly', // Filter by paymentType
            number: { $ne: 'MP009' }, // Exclude the house with number MP009
          }).populate('familyHead');

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



export const generateYearlyCollectionForSingleHouse = async (yearKey, houseNumber) => {
    try {
        // Fetch the house by house.number
        const house = await houseModel.findOne({ number: houseNumber }).populate('familyHead');

        if (!house) {
            logger.error(`House with number ${houseNumber} not found`);
            return;
        }

        // Check if the house's paymentType is 'yearly'
        if (house.paymentType !== 'yearly') {
            logger.error(`House with number ${houseNumber} is not set for yearly payments`);
            return;
        }

        // Skip if the year is already in paidYears
        if (house.paidYears.includes(yearKey)) {
            logger.info(`Skipped ${house.name} - Collection for ${yearKey} already paid`);
            return;
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
            description: `Yearly Kudi collection of ${remainingAmount} for ${house.familyHead?.name || 'unknown'} from ${house.name} house for the year ${yearKey}.`,
            category: {
                name: 'Kudi collection',
                description: `Yearly collection for ${house.familyHead?.name || 'the house'}`,
            },
            paidYear: yearKey,
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

        // Update the house's paidYears array
        house.paidYears.push(yearKey);
        await house.save();

        // Send WhatsApp message
        await sendWhatsAppMessage(house, yearKey);

        logger.info(`Yearly collection for ${yearKey} created for house with number ${houseNumber}`);
    } catch (error) {
        logger.error(`Error creating yearly collection for house with number ${houseNumber}:`, error);
    }
};



const sendWhatsAppMessage = async (house, month) => {
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
                                { type: 'text', text: house.collectionAmount * 12 },
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

export const sendWhatsAppYearlyReceipt = async (collection) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `${collection.memberId.whatsappNumber}`,
                type: 'template',
                template: {
                    name: 'yearly_collection_receipt',
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
                                    text: `${collection.paidYear}`
                                },
                                {
                                    type: 'text',
                                    text: `${collection.houseId.number}`
                                },
                                { type: 'text', text: collection.totalAmount.toString() }
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

export const sendWhatsAppPartial = async (collection, amount) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `${collection.memberId.whatsappNumber}`,
                type: 'template',
                template: {
                    name: 'collection_partial',
                    language: {
                        code: 'ml'
                    },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: collection.memberId.name },
                                { type: 'text', text: collection.paidYear },
                                { type: 'text', text: collection.totalAmount.toString() },
                                { type: 'text', text: amount.toString() },
                                { type: 'text', text: (collection.totalAmount - collection.paidAmount).toString() },
                                { type: 'text', text: collection.kudiCollectionType },
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
        console.log(error)
        logger.error('Error in sendWhatsAppPartial:', {
            error: error.response,
            collectionId: collection?._id,
            amount,
        });
    }
};