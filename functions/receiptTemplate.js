import axios from 'axios';
import dotenv from 'dotenv';
import memberModel from '../model/memberModel.js';
import logger from '../utils/logger.js';

dotenv.config({ path: './.env' });
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

export const sendReceiptNotification = async (receiptData) => {
    try {
        let recipientNumber = null;
        let recipientName = null;

        // Get recipient details based on whether it's a member or other recipient
        if (receiptData.memberId) {
            const member = await memberModel.findById(receiptData.memberId);
            if (member && member.whatsappNumber) {
                recipientNumber = member.whatsappNumber;
                recipientName = member.name;
            }
        } else if (receiptData.otherRecipient && receiptData.otherRecipient.number) {
            recipientNumber = receiptData.otherRecipient.number;
            recipientName = receiptData.otherRecipient.name;
        }

        if (!recipientNumber) {
            logger.warn('No WhatsApp number found for receipt notification');
            return { success: false, message: 'No WhatsApp number available' };
        }

        // Send WhatsApp template message
        await sendReceiptTemplate(recipientNumber, receiptData, recipientName);
        
        logger.info(`Receipt notification sent to ${recipientName} (${recipientNumber})`);
        return { success: true, message: 'Receipt notification sent successfully' };

    } catch (error) {
        logger.error('Error sending receipt notification:', error);
        return { success: false, message: 'Failed to send receipt notification', error: error.message };
    }
};

const sendReceiptTemplate = async (number, receiptData, recipientName) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `${number}`,
                type: 'template',
                template: {
                    name: 'receipt_confirmation',
                    language: { code: 'en_IN' },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: recipientName },
                                { type: 'text', text: receiptData.receiptNumber },
                                { type: 'text', text: `₹${receiptData.amount.toLocaleString('en-IN')}` },
                                { type: 'text', text: new Date(receiptData.date).toLocaleDateString('en-IN') },
                                { type: 'text', text: receiptData.categoryId?.name || 'General' }
                            ]
                        },
                          {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [
                            { type: 'text', text: `${receiptData.receiptNumber}` }  
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

        logger.info(`WhatsApp template message sent successfully to ${recipientName}:`, response.data);
    } catch (error) {
        logger.error('Error sending WhatsApp template:', error);
        throw new Error(error.response?.data?.error?.message || 'Unknown error occurred');
    }
};

