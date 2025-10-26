import express from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import recieptModel from '../model/recieptModel.js';
import logger from '../utils/logger.js';

const router = express.Router();

const formatDate = (date) => {
    const d = new Date(date);
    const day = d.toLocaleDateString('en-IN', { weekday: 'long' });
    const dayMonthYear = d.toLocaleDateString('en-IN');
    return { day, dayMonthYear };
};

const generateReceiptPDF = async (req, res) => {
    try {
        const receiptNumber = req.params.id;
        
        if (!receiptNumber) {
            return res.status(400).json({ error: 'Receipt number is required' });
        }

        // Find receipt by receipt number
        const receipt = await recieptModel.findOne({ receiptNumber })
            .populate('categoryId memberId accountId');

        if (!receipt) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        // Create PDF document
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([298, 420]); // A6 size (105 × 148 mm)
        const { width, height } = page.getSize();
        
        // Fonts
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Colors
        const black = rgb(0, 0, 0);
        const gray = rgb(0.4, 0.4, 0.4);

        let yPosition = height - 20;

        // Header
        page.drawText('VELLAP KHADIMU\'L ISLAM JAMAAT', {
            x: 20,
            y: yPosition,
            size: 8,
            font: boldFont,
            color: black,
        });
        yPosition -= 12;

        page.drawText('Reg. No: 1/88 K.W.B. Reg.No.A2/135/RA', {
            x: 20,
            y: yPosition,
            size: 6,
            font: font,
            color: gray,
        });
        yPosition -= 10;

        page.drawText('VELLAP, P.O. TRIKARIPUR-671310, KASARGOD DIST', {
            x: 20,
            y: yPosition,
            size: 6,
            font: font,
            color: gray,
        });
        yPosition -= 10;

        page.drawText('Phone: +91 9876543210', {
            x: 20,
            y: yPosition,
            size: 6,
            font: font,
            color: gray,
        });
        yPosition -= 15;

        // Separator line
        page.drawLine({
            start: { x: 20, y: yPosition },
            end: { x: width - 20, y: yPosition },
            thickness: 1,
            color: gray,
        });
        yPosition -= 15;

        // Date and Receipt Number
        const { day, dayMonthYear } = formatDate(receipt.date);
        
        page.drawText(`Date: ${dayMonthYear}`, {
            x: 20,
            y: yPosition,
            size: 7,
            font: font,
            color: black,
        });

        page.drawText(`Receipt No: ${receipt.receiptNumber}`, {
            x: 20,
            y: yPosition - 10,
            size: 7,
            font: font,
            color: black,
        });
        yPosition -= 25;

        page.drawText(`Day: ${day}`, {
            x: 20,
            y: yPosition,
            size: 7,
            font: font,
            color: black,
        });
        yPosition -= 20;

        // From Section
        const recipientName = receipt.memberId ? receipt.memberId.name : receipt.otherRecipient?.name || 'N/A';

        page.drawText(`From: ${recipientName}`, {
            x: 20,
            y: yPosition,
            size: 8,
            font: font,
            color: black,
        });
        yPosition -= 15;

        // Details heading
        page.drawText('Details:', {
            x: 20,
            y: yPosition,
            size: 7,
            font: boldFont,
            color: black,
        });
        yPosition -= 12;

        // Table header
        const tableY = yPosition;
        const tableHeight = 40;
        
        // Draw table border
        page.drawRectangle({
            x: 20,
            y: tableY - tableHeight,
            width: width - 40,
            height: tableHeight,
            borderColor: gray,
            borderWidth: 1,
        });

        // Table header row
        page.drawLine({
            start: { x: 20, y: tableY - 12 },
            end: { x: width - 20, y: tableY - 12 },
            thickness: 1,
            color: gray,
        });

        page.drawLine({
            start: { x: width - 70, y: tableY },
            end: { x: width - 70, y: tableY - tableHeight },
            thickness: 1,
            color: gray,
        });

        // Table headers
        page.drawText('Description', {
            x: 25,
            y: tableY - 10,
            size: 6,
            font: boldFont,
            color: black,
        });

        page.drawText('Amount', {
            x: width - 65,
            y: tableY - 10,
            size: 6,
            font: boldFont,
            color: black,
        });

        // Table content
        const description = receipt.description || receipt.categoryId?.name || 'Payment';
        const truncatedDesc = description.length > 20 ? description.substring(0, 20) + '...' : description;
        page.drawText(truncatedDesc, {
            x: 25,
            y: tableY - 22,
            size: 6,
            font: font,
            color: black,
        });

        page.drawText(`Rs. ${receipt.amount.toFixed(2)}`, {
            x: width - 65,
            y: tableY - 22,
            size: 6,
            font: font,
            color: black,
        });

        // Total row
        page.drawLine({
            start: { x: 20, y: tableY - 28 },
            end: { x: width - 20, y: tableY - 28 },
            thickness: 1,
            color: gray,
        });

        page.drawText('Total', {
            x: 25,
            y: tableY - 37,
            size: 6,
            font: boldFont,
            color: black,
        });

        page.drawText(`Rs. ${receipt.amount.toFixed(2)}`, {
            x: width - 65,
            y: tableY - 37,
            size: 7,
            font: boldFont,
            color: black,
        });

        yPosition = tableY - tableHeight - 20;

        // Regards
        page.drawText('Regards,', {
            x: 20,
            y: yPosition,
            size: 6,
            font: font,
            color: black,
        });
        yPosition -= 10;

        page.drawText('VKJ', {
            x: 20,
            y: yPosition,
            size: 6,
            font: font,
            color: black,
        });

        // Generate PDF
        const pdfBytes = await pdfDoc.save();

        // Set response headers for inline display
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Receipt-${receipt.receiptNumber}-${dayMonthYear}.pdf"`);
        res.setHeader('Content-Length', pdfBytes.length);

        // Send PDF directly
        res.send(Buffer.from(pdfBytes));

        logger.info(`PDF generated for receipt: ${receipt.receiptNumber}`);

    } catch (error) {
        logger.error('Error generating PDF:', error);
        res.status(500).json({ 
            error: 'Failed to generate PDF', 
            message: error.message 
        });
    }
};

export default generateReceiptPDF;