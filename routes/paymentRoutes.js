import express  from "express";
const router=express.Router()



router.post('/create-payment', async (req, res) => {
    try {
        const { amount, date, description, accountId, categoryId, status, paymentType, memberId, otherRecipient } = req.body;

        // Validate required fields
        if (!amount || !accountId || !categoryId || !paymentType) {
            return res.status(400).json({ message: 'Amount, accountId, categoryId, and paymentType are required.' });
        }

        // Validate that either memberId or otherRecipient is provided
        if (!memberId && (!otherRecipient || !otherRecipient.name || !otherRecipient.number)) {
            return res.status(400).json({ message: 'Either memberId or otherRecipient with name and number is required.' });
        }

        // If memberId is provided, validate that the member exists
        if (memberId) {
            const memberExists = await memberModel.findById(memberId);
            if (!memberExists) {
                return res.status(404).json({ message: 'Member not found.' });
            }
        }

        // Create the payment
        const newPayment = new Payment({
            amount,
            date: date || Date.now(),
            description,
            accountId,
            categoryId,
            status: status || 'Pending',
            paymentType,
            memberId: memberId || null,
            otherRecipient: memberId ? null : otherRecipient
        });

        // Save the payment to the database
        await newPayment.save();

        // Send a success response
        return res.status(201).json({
            success:true,
            message: 'Payment created successfully.', payment: newPayment });

    } catch (error) {
        return res.status(500).json({
            error,
            success: false,
            message: 'An error occurred while creating the payment.' });
    }
});



export default router