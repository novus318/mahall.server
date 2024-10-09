import express  from "express";
import staffModel from "../model/staffModel.js";
import salaryModel from "../model/salaryModel.js"
import { creditAccount, debitAccount } from "../functions/transaction.js";
import { sendWhatsAppSalary } from "../functions/generateSalary.js";
import mongoose from "mongoose";
const router=express.Router()



router.post('/create', async (req, res) => {
    try {
        const { name, age, employeeId, department, position, salary, joinDate, contactInfo } = req.body;

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
            salary,
            joinDate,
            status: 'Active',
            contactInfo,
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

        // Update the status of the staff member
        staff.status = newStatus;
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
    const { netPay, status, paymentDate, accountId, leaveDays,leaveDeduction, advanceRepayment, rejectionReason } = req.body;

    if (!payslipId || !status ) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields',
        });
    }

    try {
        let session = await mongoose.startSession();
        session.startTransaction();

        // Handle rejected payroll
        if (status === 'Rejected') {
            const updatePayslip = await salaryModel.findByIdAndUpdate(
                payslipId,
                { status: 'Rejected', rejectionReason: rejectionReason || 'No reason provided' },
                { new: true, session }
            );

            if (!updatePayslip) {
                await session.abortTransaction();
                return res.status(404).json({ success: false, message: 'Payroll not found' });
            }

            await session.commitTransaction();
            session.endSession();
            return res.status(200).json({ success: true, message: 'Payroll rejected successfully' });
        }

        // Handle payroll update
        const updatePayslip = await salaryModel.findByIdAndUpdate(
            payslipId,
            {
                advanceDeduction: advanceRepayment || 0,
                netPay,
                onleave: {
                    days: leaveDays || 0,
                    deductAmount: Number(leaveDeduction),
                },
                paymentDate,
                status,
                accountId,
            },
            { new: true, session }
        ).populate('staffId');

        if (!updatePayslip) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'Payroll not found' });
        }

        const category = 'Salary';
        const pay = updatePayslip.basicPay - updatePayslip.onleave.deductAmount;
        const ref = `/staff/details/${updatePayslip.staffId._id}`;
        const description = `Salary payment for ${updatePayslip.salaryPeriod.startDate.toDateString()} to ${updatePayslip.salaryPeriod.endDate.toDateString()} for ${updatePayslip.staffId.name}`;

        const transaction = await debitAccount(accountId, pay, description, category,ref);
        if (!transaction) {
            await salaryModel.findByIdAndUpdate(payslipId, { status: 'Pending' }, { new: true, session });
            await session.abortTransaction();
            return res.status(500).json({ message: 'Error processing transaction, please check your account balance' });
        }

        // Handle advance repayment
        if (advanceRepayment > 0) {
            const advanceDescription = `Advance repayment from ${updatePayslip.staffId.name}`;
            const advanceTransaction = await creditAccount(accountId, advanceRepayment, advanceDescription, category,ref);
            if (!advanceTransaction) {
                await salaryModel.findByIdAndUpdate(payslipId, { status: 'Pending' }, { new: true, session });
                await session.abortTransaction();
                return res.status(500).json({ message: 'Error processing advance repayment transaction, please check your account balance' });
            } else {
                await staffModel.findByIdAndUpdate(updatePayslip.staffId._id, { $inc: { advancePayment: -advanceRepayment } }, { session });
            }
        }

        // Send WhatsApp notification and finalize
        sendWhatsAppSalary(updatePayslip);
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true, message: 'Payroll updated successfully', updatePayslip });
    } catch (error) {
        console.error('Error updating payroll:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating payroll',
            error: error.message || 'Internal server error',
        });
    }
});

router.post('/repay-advance-pay/:id', async (req, res) => {
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
    updatedStaff.advancePayment -= Number(amount)
    const description = `Advance repayment from ${updatedStaff.name}`
    const category = 'Salary'
    const ref = `/staff/details/${staffId}`
    const transaction = creditAccount(targetAccount,amount,description,category,ref)
    if(!transaction){
        updatedStaff.advancePayment += Number(amount)
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
    updatedStaff.advancePayment += amount
    const description = `Advance salary payment for ${updatedStaff.name}`
    const category = 'Salary'
    const ref = `/staff/details/${staffId}`
    const transaction = debitAccount(targetAccount,amount,description,category,ref)
    if(!transaction){
        updatedStaff.advancePayment -= amount
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