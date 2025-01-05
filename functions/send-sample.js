import houseModel from "../model/houseModel.js";
import axios from "axios";
import dotenv from 'dotenv'
import logger from "../utils/logger.js";
dotenv.config({ path: './.env' })

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
export const generateMonthlySample = async () => {
    try {
        // Fetch all houses and populate the family head details
        const houses = await houseModel.find().populate('familyHead');


        for (const house of houses) {
            try {
                // Attempt to send WhatsApp message for the house
                await sendWhatsTest(house);
            } catch (sendError) {
                // Log the error and skip to the next house
                console.error(`Error sending message for house ID ${house._id}:`, sendError.message);
            }

            // Wait for 5 seconds before processing the next house
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        logger.info('Monthly collections created for all houses');
    } catch (error) {
        logger.error('Error fetching houses or creating monthly collections:', error);
    }
};

const sendWhatsTest = async (house) => {
    try {
        // Construct and send the WhatsApp message
        const response = await axios.post(
            WHATSAPP_API_URL, // Use environment variable for the API URL
            {
                messaging_product: 'whatsapp',
                to: `${house.familyHead.whatsappNumber}`,
                type: 'template',
                template: {
                    name: 'send_whatsapp_test',
                    language: { code: 'ml' }
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`, // Use environment variable for token
                    'Content-Type': 'application/json'
                }
            }
        );

        logger.info(`WhatsApp message sent successfully to ${house.familyHead.name}:`, response.data);
    } catch (error) {
        logger.error(error)
        // Throw the error to be caught in the calling function
        throw new Error(error.response?.data?.error?.message || 'Unknown error occurred');
    }
};
