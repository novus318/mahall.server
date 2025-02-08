import express from "express";
import recieptNumberModel from "../model/recieptNumberModel.js";
import { NextReceiptNumber } from "../functions/recieptNumber.js";
import PasswordModel from "../model/PasswordModel.js";
import logger from "../utils/logger.js";
import houseTypeLockModel from "../model/houseTypeLockModel.js";
const router = express.Router()




router.put('/update-collectionReceiptNumber', async (req, res) => {
    const { collectionReceiptNumber } = req.body;
    try {
        if (!collectionReceiptNumber) {
            return res.status(400).json({ message: 'Collection reciept number should be provided' });
        }

        // Update the receipt numbers in the database
        const result = await recieptNumberModel.updateOne({}, {
            $set: {
                'collectionReceiptNumber.initialNumber': collectionReceiptNumber,
                'collectionReceiptNumber.lastNumber': collectionReceiptNumber,
            }
        }, { upsert: true });

        // Respond with success
        res.status(200).json({ success: true, message: 'Receipt number reset successfully', result });
    } catch (error) {
        logger.error(error)
        res.status(500).json({ success: false, message: 'Error resetting receipt numbers', error });
    }
})

router.put('/update-paymentReceiptNumber', async (req, res) => {
    const { paymentReceiptNumber } = req.body;
    try {
        if (!paymentReceiptNumber) {
            return res.status(400).json({ message: 'Payment reciept number should be provided' });
        }

        // Update the receipt numbers in the database
        const result = await recieptNumberModel.updateOne({}, {
            $set: {
                'paymentReceiptNumber.initialNumber': paymentReceiptNumber,
                'paymentReceiptNumber.lastNumber': paymentReceiptNumber,
            }
        }, { upsert: true });

        // Respond with success
        res.status(200).json({ success: true, message: 'Receipt number reset successfully', result });
    } catch (error) {
        logger.error(error)
        res.status(500).json({ success: false, message: 'Error resetting receipt numbers', error });
    }
})

router.put('/update-receiptReceiptNumber', async (req, res) => {
    const { receiptReceiptNumber } = req.body;
    try {
        if (!receiptReceiptNumber) {
            return res.status(400).json({ message: 'Reciept number should be provided' });
        }

        // Update the receipt numbers in the database
        const result = await recieptNumberModel.updateOne({}, {
            $set: {
                'receiptReceiptNumber.initialNumber': receiptReceiptNumber,
                'receiptReceiptNumber.lastNumber': receiptReceiptNumber,
            }
        }, { upsert: true });

        // Respond with success
        res.status(200).json({ success: true, message: 'Receipt number reset successfully', result });
    } catch (error) {
        logger.error(error)
        res.status(500).json({ success: false, message: 'Error resetting receipt numbers', error });
    }
})

router.get('/get-collection/number', async (req, res) => {
    try {

        const receiptNumber = await recieptNumberModel.findOne();

        if (receiptNumber && receiptNumber.collectionReceiptNumber) {
            const lastNumber = receiptNumber.collectionReceiptNumber.lastNumber
            const newNumber = await NextReceiptNumber(lastNumber)

            return res.status(200).json({ success: true, Number: newNumber });
        }
    } catch (error) {
        logger.error(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/update/house-lock', async (req, res) => {
    const { pin, user } = req.body;

    try {
        // Find the user's password record
        const userName = await PasswordModel.findOne({ user: user });
        if (!userName) {
            return res.status(401).send({ success: false, message: "User not found" });
        }

        // Check if the provided PIN matches the stored PIN
        if (pin === userName.passkey) {
            // Find the existing houseLock document or create a new one if it doesn't exist
            let houseLock = await houseTypeLockModel.findOne();
            if (!houseLock) {
                houseLock = new houseTypeLockModel({ isEnabled: false }); // Default to false if creating new
            }

            // Toggle the `isEnabled` field
            houseLock.isEnabled = !houseLock.isEnabled;
            await houseLock.save();

            return res.status(200).send({
                success: true,
                message: `House lock ${houseLock.isEnabled ? 'enabled' : 'disabled'}`,
                isEnabled: houseLock.isEnabled,
            });
        } else {
            return res.status(401).send({ success: false, message: 'Invalid PIN' });
        }
    } catch (error) {
        logger.error('/update/house-lock', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

router.get('/house-lock/status', async (req, res) => {
    try {
        // Find the house lock document
        let houseLock = await houseTypeLockModel.findOne();

        // If no document exists, create a new one with isEnabled set to true
        if (!houseLock) {
            houseLock = new houseTypeLockModel({ isEnabled: true });
            await houseLock.save();
        }

        return res.status(200).send({
            success: true,
            isEnabled: houseLock.isEnabled,
        });
    } catch (error) {
        logger.error('/house-lock/status', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});




export default router