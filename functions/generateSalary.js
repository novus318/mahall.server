import salaryModel from "../model/salaryModel.js";
import staffModel from "../model/staffModel.js";

export const generateMonthlySalaries = async () => {
    try {
        // Get the first day of the previous month and the first day of the current month
        const currentDate = new Date();

        // Start of this month (1st of the current month)
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        // Start of last month (1st of the previous month)
        const startOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        

        // Find all active staff members
        const activeStaffs = await staffModel.find({ "statusHistory.status": "Active" });

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
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: `+91${salary.staffId.contactInfo.phone}`,
                type: 'template',
                template: {
                    name: 'salary_confirm',
                    language: {
                        code: 'en' 
                    },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: salary.staffId.name },     
                                { type: 'text', text: salary.netPay },   
                                { type: 'text', text: `https://mahall.vercel.app/salary/${salary.staffId}` },        
                            ]
                        },
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

