import houseModel from "../model/houseModel.js";
import axios from "axios";
import dotenv from 'dotenv'
import logger from "../utils/logger.js";
dotenv.config({ path: './.env' })

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
import xlsx from 'xlsx';


export const generateMonthlySample = async () => {
    try {
        // Fetch all houses and populate the family head details
        const houses = await houseModel.find().populate('familyHead');

        // Create a new workbook and a worksheet
        const workbook = xlsx.utils.book_new();
        const worksheetData = [];

        // Add headers to the worksheet
        worksheetData.push(['Name', 'WhatsApp Number']);

        for (const house of houses) {
            try {
                // Extract family head details
                const familyHead = house.familyHead;
                if (familyHead && familyHead.name && familyHead.whatsappNumber) {
                    // Add family head details to the worksheet data
                    worksheetData.push([familyHead.name, familyHead.whatsappNumber]);
                }
            } catch (sendError) {
                // Log the error and skip to the next house
                console.log(`Error processing house ${house._id}:`, sendError);
            }

            // Wait for 2 seconds before processing the next house
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Create a worksheet from the data
        const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);

        // Add the worksheet to the workbook
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Family Heads');

        // Write the workbook to a file
        xlsx.writeFile(workbook, 'familyheads.xls');

        console.log('Monthly collections created for all houses');
    } catch (error) {
        console.log('Error fetching houses or creating monthly collections:', error);
    }
};

const sendWhatsTest = async (number) => {
    try {
        // Construct and send the WhatsApp message
        const response = await axios.post(
            WHATSAPP_API_URL, // Use environment variable for the API URL
            {
                messaging_product: 'whatsapp',
                to: `${number}`,
                type: 'template',
                template: {
                    name: 'launch_alert',
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
