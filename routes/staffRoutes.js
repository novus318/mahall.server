import express  from "express";
import staffModel from "../model/staffModel.js";
import salaryModel from "../model/salaryModel.js"
import { debitAccount } from "../functions/transaction.js";
import { sendWhatsAppSalary } from "../functions/generateSalary.js";
const router=express.Router()



router.post('/create', async (req, res) => {
    try {
        const { name, age, employeeId, department, position, salary,firstSalary, joinDate, contactInfo } = req.body;

        const existingStaff = await staffModel.findOne({ employeeId: employeeId });
        if (existingStaff) {
            return res.status(400).send({ success: false, message: 'Employee ID already exists' });
        }
        // Create a new staff instance
        const newStaff = new staffModel({
            name,
            age,
            employeeId,
            department,
            position,
            firstSalary,
            salary,
            joinDate,
            contactInfo,
        });
        // Add a new status to the history array
        newStaff.statusHistory.push({
            status: 'Active',
            startDate: joinDate,
            endDate: null,
        });

        // Save the new staff member to the database
        await newStaff.save();

        res.status(201).json({ 
            success:true,
            message: 'Staff member created successfully' });
    } catch (error) {
        console.error('Error creating staff:', error);
        res.status(500).json({ message: 'Error creating staff member' });
    }
});

router.put('/update-status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { newStatus } = req.body; // Assume newStatus is provided in the request body
        
        // Find the staff member by ID
        const staff = await staffModel.findById(id);
        
        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        // End the current status if it exists
        const currentStatus = staff.statusHistory[staff.statusHistory.length - 1];
        if (currentStatus && !currentStatus.endDate) {
            currentStatus.endDate = new Date(); // Set end date for the current status
        }

        // Add the new status
        staff.statusHistory.push({
            status: newStatus,
            startDate: new Date()
        });

        await staff.save();

        res.status(200).json({ success:true ,message: 'Staff status updated successfully', staff });
    } catch (error) {
        console.error('Error updating staff status:', error);
        res.status(500).json({success:false, message: 'Error updating staff status' });
    }
});

router.put('/edit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, age, employeeId, department, position, salary, joinDate, contactInfo } = req.body;

        // Find staff member by ID and update
        const updatedStaff = await staffModel.findByIdAndUpdate(
            id,
            {
                name,
                age,
                employeeId,
                department,
                position,
                salary,
                joinDate,
                contactInfo,
            },
            { new: true } // Return the updated document
        );

        if (!updatedStaff) {
            return res.status(404).json({
                success:false,
                message: 'Staff member not found' });
        }

        res.status(200).json({
            success:true,
            message: 'Staff member updated successfully', staff: updatedStaff });
    } catch (error) {
        console.log(error)
        res.status(500).json({ 
            error,
            success:true,
            message: 'Error updating staff member' });
    }
});

router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Find staff member by ID and remove
        const deletedStaff = await staffModel.findByIdAndDelete(id);

        if (!deletedStaff) {
            return res.status(404).json({ 
                success:false,
                message: 'Staff member not found' });
        }

        res.status(200).json({ 
            success:true,
            message: 'Staff member deleted successfully', staff: deletedStaff });
    } catch (error) {
        res.status(500).json({
            error,
            success: false,
            message: 'Error deleting staff member' });
    }
})

router.get('/get/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Find staff member by ID
        const staff = await staffModel.findById(id);

        if (!staff) {
            return res.status(404).json({
                success:false,
                message: 'Staff member not found' });
            }

            const payslips = await salaryModel.find({ staffId: id, status:{ $ne: 'Pending' } }).limit(10).sort({
                updatedAt: -1,
            });

        res.status(200).json({ success:true, message: 'Staff member retrieved successfully', staff,payslips });
    } catch (error) {
        res.status(500).json({ 
            error,
            success: false,
            message: 'Error retrieving staff member' });
    }
});

router.get('/all-staff', async (req, res) => {
    try {
        // Fetch all staff members
        const staff = await staffModel.find().sort({
            createdAt: -1,
        });

        res.status(200).json({ success: true, staff });
    } catch (error) {
        res.status(500).json({ 
            error,
            success:false,
            message: 'Error retrieving staff members' });
    }
});

router.get('/pending-salaries', async (req, res) => {
    try {
        // Fetch all pending payslips
        const payslips = await salaryModel.find({ status: 'Pending' }).sort({
            createdAt: -1,
        }).populate('staffId');

        res.status(200).json({ success: true, payslips });
    } catch (error) {
     
    }
});

router.put('/update/salary/:id', async (req, res) => {
    const payslipId = req.params.id;
    const { deductions, netPay,status, paymentDate,accountId } = req.body; // Extract the fields from the request body

    try {
        if(status === 'Rejected'){
            await salaryModel.findByIdAndUpdate(
                payslipId,
                { status: 'Rejected' },
                { new: true }
            )
            return res.status(200).json({ 
                success: true,
                message: 'Payroll rejected successfully',
            });
        }
        // Find the payslip by ID and update it
        const updatePayslip = await salaryModel.findByIdAndUpdate(
            payslipId,
            { 
                deductions,
                netPay,
                paymentDate,
                status: status,
                accountId,
             },
            { new: true }
        ).populate('staffId');

        if (!updatePayslip) {
            return res.status(404).json({ 
                success: false,
                message: 'Payroll not found' 
            });
        }
            const category = 'Salary'
            const description = `Salary payment for  ${updatePayslip.salaryPeriod.startDate.toDateString()} to ${updatePayslip.salaryPeriod.endDate.toDateString()} for ${updatePayslip.staffId.name}`
            const transaction= await debitAccount(accountId,netPay,description,category)
            if(!transaction){
                await salaryModel.findByIdAndUpdate(
                    payslipId,
                    { status: 'Pending' },
                    { new: true }
                )
                return res.status(500).json({ message: 'Error processing transaction please check your account balance' });
            }else{
                sendWhatsAppSalary(updatePayslip)
                res.status(200).json({ 
                    success: true,
                    message: 'Payroll updated successfully', 
                    updatePayslip 
                });
            }
    } catch (error) {
        console.log(error)
        res.status(500).json({ 
            error,
            success: false,
            message: 'Error updating payroll' 
        });
    }
});

router.post('/request-advance-pay/:id', async (req, res) => {
    const staffId = req.params.id;
    const { amount, targetAccount } = req.body; // Extract the fields from the request body
try {
    const updatedStaff = await staffModel.findById(staffId);
    if (!updatedStaff) {
        return res.status(404).json({ 
            success: false,
            message: 'Staff member not found' 
        });
    }
    updatedStaff.advancePay += amount
    const description = `Advance salary payment for ${updatedStaff.name}`
    const category = 'Salary'
    const transaction = debitAccount(targetAccount,amount,description,category)
    if(!transaction){
        updatedStaff.advancePay -= amount
        return res.status(500).json({ success:false,message: 'Error processing transaction please check your account balance' });
    }else{
    await updatedStaff.save()
    res.status(200).json({ 
        success: true,
        message: 'Advance payment  successfull', 
        updatedStaff 
    });
}
} catch (error) {
    res.status(500).json({ 
        error,
        success: false,
        message: 'Error processing advance payment' 
    });
}
 
});
router.get('/pending-salary/:id', async (req, res) => {
    try {
        const staffId = req.params.id;
        // Fetch all pending payslips for a specific staff member
        const payslips = await salaryModel.find({ staffId, status: 'Pending' }).sort({
            createdAt: -1,
        }).populate('staffId');

        res.status(200).json({ success: true, payslips });
    } catch (error) {
        res.status(500).json({ 
            error,
            success: false,
            message: 'Error retrieving pending payrolls' 
        });
    }
});



export default router