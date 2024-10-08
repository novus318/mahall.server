import axios from "axios";
import dotenv from 'dotenv'
dotenv.config({ path: './.env' })
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

export const sendCustomMessage = async (mobile, message) => {
    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `91${mobile}`,
                type: 'text',
                text: {
                    body: message
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Message sent successfully:', response.data.contacts);
        console.log('Message sent successfully:', response.data.messages);
    } catch (error) {
      console.error('Error sending message:', error.response ? error.response.data : error.message);
    }
  }
