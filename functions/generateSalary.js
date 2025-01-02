import axios from "axios";
import salaryModel from "../model/salaryModel.js";
import staffModel from "../model/staffModel.js";
import dotenv from 'dotenv'

dotenv.config({ path: './.env' })
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

export const generateMonthlySalaries = async () => {
    try {
        // Get the first day of the previous month and the first day of the current month
        const currentDate = new Date();

        // Start of this month (1st of the current month)
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        // Start of last month (1st of the previous month)
        const startOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        

        // Find all active staff members
        const activeStaffs = await staffModel.find({ status: 'Active' });

        // Loop through each active staff and create a salary record
        for (const staff of activeStaffs) {
            const salary = new salaryModel({
                staffId: staff._id,
                basicPay: staff.salary,
                salaryPeriod: {
                    startDate: startOfLastMonth,
                    endDate: startOfMonth
                },
                status: 'Pending'
            });
            await salary.save();
        }

        console.log('Monthly salary created for all active staffs');
    } catch (error) {
        console.error('Error creating monthly salary:', error);
    }
};

export const sendWhatsAppSalary = async (salary) => {
    try {
        const netPay = salary.netPay;

// Format netPay to two decimal places and add comma separators
const formattedNetPay = netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const month = salary.salaryPeriod?.startDate?.toLocaleString('default', { month: 'long' });
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `${salary.staffId.contactInfo.phone}`,
                type: 'template',
                template: {
                    name: 'salary_confirm',
                    language: {
                        code: 'ml' 
                    },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: `${salary.staffId.name}` },     
                                { type: 'text', text: `${month}` },   
                                { type: 'text', text: `${formattedNetPay}`},
                            ]
                        },
                        {
                            type: 'button',
                            sub_type: 'url',
                            index: '0',
                            parameters: [
                                { type: 'text', text: `${salary.staffId._id}` }  
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
        console.error('Error sending WhatsApp message:', error);
    }
};

