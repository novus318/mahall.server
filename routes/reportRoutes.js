import express  from "express";
import BankModel from "../model/BankModel.js";
import recieptModel from "../model/recieptModel.js";
import paymentModel from "../model/paymentModel.js";
import memberModel from "../model/memberModel.js";
import houseModel from "../model/houseModel.js";
import kudiCollection from "../model/kudiCollection.js";
import buildingModel from "../model/buildingModel.js";
import staffModel from "../model/staffModel.js";
import salaryModel from "../model/salaryModel.js";
import logger from "../utils/logger.js";
import ExcelJS from "exceljs";

const router=express.Router()

router.get('/dashboard', async (req, res) => {
    const assets = await BankModel.find({ accountType: { $in: ['bank', 'cash'] } });
    const members = await memberModel.find().countDocuments();
    const staffs = await staffModel.find().countDocuments();
    const totalBalance = assets.reduce((sum, asset) => sum + asset.balance, 0);
    const formattedTotalBalance = totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const data = [
        { title: "Tuition Fees", link: 'Tution'},
        { title: "Rent" ,link: 'rent'},
        { title: "Payments", link: 'Payments'},
        { title: "Receipts",  link: 'Reciepts'},
        { title: "Accounts", value: `₹${formattedTotalBalance}`, link: 'Accounts'},
        { title: "Members", value: members ,link: 'members'},
        { title: "Staff",  value: staffs,link: 'staff'},
      ]
    res.send({
        success:true,
        data:data
    });
});

router.get('/get/reciept/byDate', async (req, res) => {
    try {
        // Get startDate and endDate from query parameters
        const { startDate, endDate } = req.query;

        // If no dates are provided, return an error
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        // Convert the dates to JavaScript Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        start.setHours(0, 0, 0, 0);
        // Set the end date to include the entire day
        end.setHours(23, 59, 59, 999);

        // Query the database for receipts between the given dates
        const reciepts = await recieptModel.find({
          $or: [
                { date: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end } }
            ]
        })
        .sort({ date: 1, createdAt: 1 })
        .populate('categoryId memberId otherRecipient')
        .populate({
            path: 'accountId',
            model: 'bank', // Make sure this matches your bank account model name
            select: 'name holderName accountNumber' // Include relevant bank account fields
        });

        // If no receipts found
        if (!reciepts || reciepts.length === 0) {
            return res.status(404).json({ success: false, message: 'No receipts found for the given date range' });
        }

        // Return the receipts
        res.status(200).json({ success: true, reciepts });
    } catch (error) {
        logger.error(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/get/reciept/excel', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        const reciepts = await recieptModel.find({
            $or: [
                { date: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end } }
            ]
        })
        .sort({ date: 1, createdAt: 1 })
        .populate('categoryId memberId otherRecipient')
        .populate({
            path: 'accountId',
            model: 'bank',
            select: 'name holderName'
        });

        if (!reciepts || reciepts.length === 0) {
            return res.status(404).json({ success: false, message: 'No receipts found for the given date range' });
        }

        // Create a new workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Receipts');

        // Define columns
        worksheet.columns = [
            { header: '#', key: 'serial', width: 10 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Receipt No.', key: 'receiptNumber', width: 15 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'From', key: 'from', width: 25 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Account', key: 'account', width: 20 },
            { header: 'Status', key: 'status', width: 12 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data rows
        reciepts.forEach((reciept, index) => {
            const row = worksheet.addRow({
                serial: index + 1,
                date: reciept.date
                    ? new Date(reciept.date).toLocaleDateString('en-GB')
                    : new Date(reciept.createdAt).toLocaleDateString('en-GB'),
                receiptNumber: reciept.receiptNumber || 'N/A',
                category: reciept.categoryId?.name ||  'N/A',
                from: reciept.memberId?.name || reciept.otherRecipient?.name || 'N/A',
                amount: reciept.amount || 0,
                account: reciept.accountId?.name || 'NIL',
                status: reciept.status || 'N/A'
            });

            // Format currency column
            row.getCell('amount').numFmt = '₹#,##0.00';
        });

        // Add totals row
        const totalAmount = reciepts.reduce((sum, reciept) => sum + (reciept.amount || 0), 0);

        const totalRow = worksheet.addRow({
            serial: '',
            date: '',
            receiptNumber: '',
            category: '',
            from: 'TOTAL',
            amount: totalAmount,
            paymentTo: '',
            account: '',
            status: ''
        });
        totalRow.font = { bold: true };
        totalRow.getCell('amount').numFmt = '₹#,##0.00';

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Receipts-${new Date(start).toLocaleDateString('en-GB')}-to-${new Date(end).toLocaleDateString('en-GB')}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error(error);
        res.status(500).send({
            success: false,
            message: `Server Error: ${error}`,
            error
        });
    }
});

router.get('/get/payment/byDate', async (req, res) => {
    try {
        // Get startDate and endDate from query parameters
        const { startDate, endDate } = req.query;

        // If no dates are provided, return an error
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        // Convert the dates to JavaScript Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Set the end date to include the entire day
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0); 

        const payments = await paymentModel.find({
            $or: [
                { date: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end } }
            ]
        })
        .sort({ date: 1, createdAt: 1 })
        .populate('categoryId')
        .populate({
            path: 'accountId',
            model: 'bank', // Make sure this matches your bank account model name
            select: 'name holderName' // Only include these fields
        });

        // If no receipts found
        if (!payments || payments.length === 0) {
            return res.status(404).json({ success: false, message: 'No payments found for the given date range' });
        }

        // Return the receipts
        res.status(200).json({ success: true, payments });
    } catch (error) {
        logger.error(error)
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/get/payment/excel', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        const payments = await paymentModel.find({
            $or: [
                { date: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end } }
            ]
        })
        .sort({ date: 1, createdAt: 1 })
        .populate('categoryId')
        .populate({
            path: 'accountId',
            model: 'bank',
            select: 'name holderName'
        });

        if (!payments || payments.length === 0) {
            return res.status(404).json({ success: false, message: 'No payments found' });
        }

        // Create a new workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payments');

        // Define columns
        worksheet.columns = [
            { header: '#', key: 'serial', width: 10 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Receipt No.', key: 'receiptNumber', width: 15 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Payment To', key: 'paymentTo', width: 25 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Payment Type', key: 'paymentType', width: 15 },
            { header: 'Account', key: 'account', width: 20 },
            { header: 'Status', key: 'status', width: 12 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data rows
        payments.forEach((payment, index) => {
            const row = worksheet.addRow({
                serial: index + 1,
                date: payment.date
                    ? new Date(payment.date).toLocaleDateString('en-GB')
                    : new Date(payment.createdAt).toLocaleDateString('en-GB'),
                receiptNumber: payment.receiptNumber || 'N/A',
                category: payment.categoryId?.name || 'N/A',
                paymentTo: payment.paymentTo || 'N/A',
                amount: payment.total || 0,
                paymentType: payment.paymentType || 'N/A',
                account: payment.accountId?.name || 'NIL',
                status: payment.status || 'N/A'
            });

            // Format currency column
            row.getCell('amount').numFmt = '₹#,##0.00';
        });

        // Add totals row
        const totalAmount = payments.reduce((sum, payment) => sum + (payment.total || 0), 0);

        const totalRow = worksheet.addRow({
            serial: '',
            date: '',
            receiptNumber: '',
            category: '',
            paymentTo: 'TOTAL',
            amount: totalAmount,
            paymentType: '',
            account: '',
            status: ''
        });
        totalRow.font = { bold: true };
        totalRow.getCell('amount').numFmt = '₹#,##0.00';

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Payments-${new Date(start).toLocaleDateString('en-GB')}-to-${new Date(end).toLocaleDateString('en-GB')}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error(error);
        res.status(500).send({
            success: false,
            message: `Server Error: ${error}`,
            error
        });
    }
});

router.get('/get/members', async (req, res) => {
    try {
        const houses = await houseModel.find().populate('familyHead');
        const houseWithMembers = await Promise.all(
            houses.map(async (house) => {
              const members = await memberModel.find({ house: house._id });
      
              return {
                house: house.name,
                houseId: house._id,
                familyHead:house.familyHead.name,
                totalMembers: members.length,
               houseNumber: house.number,
                members,
              };
            })
          );
  
      res.status(200).json({ success: true, houseWithMembers });
    } catch (error) {
    logger.error(error)
      res.status(500).json({ success: false, message: 'Error fetching members with house details', error: error.message });
    }
  });

  router.get('/get/collections/byDate', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        // Convert the dates to JavaScript Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Set the end date to include the entire day
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        // Find collections where either PaymentDate or createdAt falls within the date range
        const collections = await kudiCollection.find({
            $or: [
                { PaymentDate: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end }, PaymentDate: { $exists: false } }
            ]
        }).sort({
            PaymentDate: -1,
            createdAt: -1 // Sort by createdAt if PaymentDate is not available
        }).populate('memberId houseId accountId');

        if (!collections || collections.length === 0) {
            return res.status(404).json({ success: false, message: 'No collections found' });
        }

        res.status(200).send({ success: true, collections });
    } catch (error) {
        logger.error(error);
        res.status(500).send({
            success: false, message: `Server Error: ${error}`,
            error
        });
    }
});

router.get('/get/collections/excel', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        const collections = await kudiCollection.find({
            $or: [
                { PaymentDate: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end }, PaymentDate: { $exists: false } }
            ]
        }).sort({
            PaymentDate: -1,
            createdAt: -1
        }).populate('memberId houseId accountId');

        if (!collections || collections.length === 0) {
            return res.status(404).json({ success: false, message: 'No collections found' });
        }

        // Create a new workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Tuition Collections');

        // Define columns
        worksheet.columns = [
            { header: '#', key: 'serial', width: 10 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Receipt No.', key: 'receiptNumber', width: 15 },
            { header: 'House', key: 'house', width: 15 },
            { header: 'Collection Amount', key: 'amount', width: 18 },
            { header: 'Amount Paid', key: 'paidAmount', width: 18 },
            { header: 'Family Head', key: 'familyHead', width: 25 },
            { header: 'Payment Date', key: 'paymentDate', width: 15 },
            { header: 'Account', key: 'account', width: 20 },
            { header: 'Status', key: 'status', width: 12 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data rows
        collections.forEach((collection, index) => {
            const row = worksheet.addRow({
                serial: index + 1,
                date: collection.paymentType === 'monthly' ? collection.collectionMonth : collection.paidYear,
                receiptNumber: collection.receiptNumber || 'N/A',
                house: collection.houseId?.number || 'N/A',
                amount: collection.amount || 0,
                paidAmount: collection.paymentType === 'monthly' && collection.status === 'Paid'
                    ? collection.amount || 0
                    : collection.paidAmount || 0,
                familyHead: collection.memberId?.name || 'N/A',
                paymentDate: collection.PaymentDate
                    ? new Date(collection.PaymentDate).toLocaleDateString('en-GB')
                    : 'NIL',
                account: collection.accountId?.name || 'NIL',
                status: collection.status || 'N/A'
            });

            // Format currency columns
            row.getCell('amount').numFmt = '₹#,##0.00';
            row.getCell('paidAmount').numFmt = '₹#,##0.00';

            // Add partial payments as sub-rows if applicable
            if (collection.paymentType === 'yearly' && collection.partialPayments?.length > 0) {
                collection.partialPayments.forEach((payment) => {
                    const partialRow = worksheet.addRow({
                        serial: '',
                        date: '',
                        receiptNumber: payment.receiptNumber || '',
                        house: '',
                        amount: '',
                        paidAmount: payment.amount || 0,
                        familyHead: '',
                        paymentDate: payment.paymentDate
                            ? new Date(payment.paymentDate).toLocaleDateString('en-GB')
                            : '',
                        account: '',
                        status: payment.description || 'Partial Payment'
                    });
                    partialRow.getCell('paidAmount').numFmt = '₹#,##0.00';
                    partialRow.font = { italic: true, color: { argb: 'FF666666' } };
                });
            }
        });

        // Add totals row
        const totalAmount = collections.reduce((sum, col) => sum + (col.amount || 0), 0);
        const totalPaid = collections.reduce((sum, col) => {
            if (col.paymentType === 'monthly' && col.status === 'Paid') {
                return sum + (col.amount || 0);
            }
            return sum + (col.paidAmount || 0);
        }, 0);

        const totalRow = worksheet.addRow({
            serial: '',
            date: '',
            receiptNumber: '',
            house: 'TOTAL',
            amount: totalAmount,
            paidAmount: totalPaid,
            familyHead: '',
            paymentDate: '',
            account: '',
            status: ''
        });
        totalRow.font = { bold: true };
        totalRow.getCell('amount').numFmt = '₹#,##0.00';
        totalRow.getCell('paidAmount').numFmt = '₹#,##0.00';

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Tuition-Collections-${new Date(start).toLocaleDateString('en-GB')}-to-${new Date(end).toLocaleDateString('en-GB')}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error(error);
        res.status(500).send({
            success: false,
            message: `Server Error: ${error}`,
            error
        });
    }
});

router.get('/rent-collections/byDate', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        // Convert the dates to JavaScript Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Set to beginning and end of day
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const buildings = await buildingModel.find({
            $or: [
                { "rooms.contractHistory.rentCollection.date": { $gte: start, $lte: end } },
                { "rooms.contractHistory.rentCollection.paymentDate": { $gte: start, $lte: end } }
            ]
        })
        .populate({
            path: 'rooms.contractHistory.rentCollection.accountId',
            model: 'bank',
            select: 'name holderName' // Only select these fields
        })
        .lean();

        const collections = [];

        buildings.forEach((building) => {
            building.rooms.forEach((room) => {
                room.contractHistory.forEach((contract) => {
                    contract.rentCollection
                        .filter((collection) => {
                            const dueDate = collection.date;
                            const payDate = collection.paymentDate;
                            return (dueDate >= start && dueDate <= end) ||
                                   (payDate && payDate >= start && payDate <= end);
                        })
                        .forEach((collection) => {
                            collections.push({
                                buildingID: building.buildingID,
                                buildingId: building._id,
                                roomId: room._id,
                                shop: contract.shop,
                                contractId: contract._id,
                                buildingName: building.buildingName,
                                roomNumber: room.roomNumber,
                                tenantName: contract.tenant.name,
                                tenantNumber: contract.tenant.number,
                                rent: contract.rent,
                                rentId: collection._id,
                                deposit: contract.deposit,
                                period: collection.period,
                                amount: collection.amount,
                                PaymentAmount: collection.PaymentAmount,
                                paymentDate: collection.paymentDate,
                                paidAmount: collection.paidAmount || 0,
                                status: collection.status,
                                onleave: collection.onleave,
                                partialPayments: collection.partialPayments,
                                dueDate: collection.date,
                                advancePayment: contract.advancePayment,
                                accountDetails: collection.accountId ? {
                                    name: collection.accountId.name,
                                    holderName: collection.accountId.holderName
                                } : null
                            });
                        });
                });
            });
        });

        // Sort by paymentDate first (descending), then by date (descending)
        collections.sort((a, b) => {
            // Handle cases where paymentDate might be null/undefined
            const aPaymentDate = a.paymentDate ? new Date(a.paymentDate) : null;
            const bPaymentDate = b.paymentDate ? new Date(b.paymentDate) : null;
            const aDueDate = new Date(a.dueDate);
            const bDueDate = new Date(b.dueDate);

            // If both have paymentDate, compare them
            if (aPaymentDate && bPaymentDate) {
                const paymentComparison = bPaymentDate - aPaymentDate;
                if (paymentComparison !== 0) return paymentComparison;
                // If paymentDates are equal, compare dueDates
                return bDueDate - aDueDate;
            }

            // If only one has paymentDate, put it first
            if (aPaymentDate) return -1;
            if (bPaymentDate) return 1;

            // If neither has paymentDate, compare dueDates
            return bDueDate - aDueDate;
        });

        res.status(200).json({ success: true, collections });
    } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
});

router.get('/rent-collections/excel', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        // Set to beginning and end of day
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const buildings = await buildingModel.find({
            $or: [
                { "rooms.contractHistory.rentCollection.date": { $gte: start, $lte: end } },
                { "rooms.contractHistory.rentCollection.paymentDate": { $gte: start, $lte: end } }
            ]
        })
        .populate({
            path: 'rooms.contractHistory.rentCollection.accountId',
            model: 'bank',
            select: 'name holderName'
        })
        .lean();

        const collections = [];

        buildings.forEach((building) => {
            building.rooms.forEach((room) => {
                room.contractHistory.forEach((contract) => {
                    contract.rentCollection
                        .filter((collection) => {
                            const dueDate = collection.date;
                            const payDate = collection.paymentDate;
                            return (dueDate >= start && dueDate <= end) ||
                                   (payDate && payDate >= start && payDate <= end);
                        })
                        .forEach((collection) => {
                            collections.push({
                                buildingID: building.buildingID,
                                buildingName: building.buildingName,
                                roomNumber: room.roomNumber,
                                tenantName: contract.tenant.name,
                                tenantNumber: contract.tenant.number,
                                rent: contract.rent,
                                period: collection.period,
                                amount: collection.amount,
                                paidAmount: collection.paidAmount || 0,
                                paymentDate: collection.paymentDate,
                                status: collection.status,
                                onleave: collection.onleave,
                                partialPayments: collection.partialPayments,
                                dueDate: collection.date,
                                accountDetails: collection.accountId
                            });
                        });
                });
            });
        });

        // Sort by paymentDate first (descending), then by date (descending)
        collections.sort((a, b) => {
            // Handle cases where paymentDate might be null/undefined
            const aPaymentDate = a.paymentDate ? new Date(a.paymentDate) : null;
            const bPaymentDate = b.paymentDate ? new Date(b.paymentDate) : null;
            const aDueDate = new Date(a.dueDate);
            const bDueDate = new Date(b.dueDate);

            // If both have paymentDate, compare them
            if (aPaymentDate && bPaymentDate) {
                const paymentComparison = bPaymentDate - aPaymentDate;
                if (paymentComparison !== 0) return paymentComparison;
                // If paymentDates are equal, compare dueDates
                return bDueDate - aDueDate;
            }

            // If only one has paymentDate, put it first
            if (aPaymentDate) return -1;
            if (bPaymentDate) return 1;

            // If neither has paymentDate, compare dueDates
            return bDueDate - aDueDate;
        });

        if (!collections || collections.length === 0) {
            return res.status(404).json({ success: false, message: 'No rent collections found' });
        }

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rent Collections');

        // Define columns
        worksheet.columns = [
            { header: '#', key: 'serial', width: 10 },
            { header: 'Building ID', key: 'buildingID', width: 15 },
            { header: 'Building Name', key: 'buildingName', width: 20 },
            { header: 'Room No.', key: 'roomNumber', width: 12 },
            { header: 'Tenant Name', key: 'tenantName', width: 25 },
            { header: 'Tenant Number', key: 'tenantNumber', width: 15 },
            { header: 'Period', key: 'period', width: 15 },
            { header: 'Rent Amount', key: 'rent', width: 15 },
            { header: 'Amount Paid', key: 'paidAmount', width: 15 },
            { header: 'Payment Date', key: 'paymentDate', width: 15 },
            { header: 'Due Date', key: 'dueDate', width: 15 },
            { header: 'Account', key: 'account', width: 20 },
            { header: 'Status', key: 'status', width: 12 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data rows
        collections.forEach((collection, index) => {
            const row = worksheet.addRow({
                serial: index + 1,
                buildingID: collection.buildingID || 'N/A',
                buildingName: collection.buildingName || 'N/A',
                roomNumber: collection.roomNumber || 'N/A',
                tenantName: collection.tenantName || 'N/A',
                tenantNumber: collection.tenantNumber || 'N/A',
                period: collection.period || 'N/A',
                rent: collection.rent || 0,
                paidAmount: collection.paidAmount || 0,
                paymentDate: collection.paymentDate
                    ? new Date(collection.paymentDate).toLocaleDateString('en-GB')
                    : 'NIL',
                dueDate: collection.dueDate
                    ? new Date(collection.dueDate).toLocaleDateString('en-GB')
                    : 'NIL',
                account: collection.accountDetails?.name || 'NIL',
                status: collection.status || 'N/A'
            });

            // Format currency columns
            row.getCell('rent').numFmt = '₹#,##0.00';
            row.getCell('paidAmount').numFmt = '₹#,##0.00';

            // Add partial payments as sub-rows if applicable
            if (collection.partialPayments?.length > 0) {
                collection.partialPayments.forEach((payment) => {
                    const partialRow = worksheet.addRow({
                        serial: '',
                        buildingID: '',
                        buildingName: '',
                        roomNumber: '',
                        tenantName: '',
                        tenantNumber: '',
                        period: '',
                        rent: '',
                        paidAmount: payment.amount || 0,
                        paymentDate: payment.date
                            ? new Date(payment.date).toLocaleDateString('en-GB')
                            : '',
                        dueDate: '',
                        account: '',
                        status: 'Partial Payment'
                    });
                    partialRow.getCell('paidAmount').numFmt = '₹#,##0.00';
                    partialRow.font = { italic: true, color: { argb: 'FF666666' } };
                });
            }
        });

        // Add totals row
        const totalRent = collections.reduce((sum, col) => sum + (col.rent || 0), 0);
        const totalPaid = collections.reduce((sum, col) => sum + (col.paidAmount || 0), 0);

        const totalRow = worksheet.addRow({
            serial: '',
            buildingID: '',
            buildingName: '',
            roomNumber: '',
            tenantName: '',
            tenantNumber: '',
            period: 'TOTAL',
            rent: totalRent,
            paidAmount: totalPaid,
            paymentDate: '',
            dueDate: '',
            account: '',
            status: ''
        });
        totalRow.font = { bold: true };
        totalRow.getCell('rent').numFmt = '₹#,##0.00';
        totalRow.getCell('paidAmount').numFmt = '₹#,##0.00';

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Rent-Collections-${new Date(start).toLocaleDateString('en-GB')}-to-${new Date(end).toLocaleDateString('en-GB')}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
});

  router.get('/get/salary/byDate', async (req, res) => {
    try {
      // Get startDate and endDate from query parameters
      const { startDate, endDate } = req.query;

      // If no dates are provided, return an error
      if (!startDate || !endDate) {
          return res.status(400).json({ success: false, message: 'Please provide both startDate and endDate' });
      }

      // Convert the dates to JavaScript Date objects
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Set the end date to include the entire day
      end.setHours(23, 59, 59, 999);
      start.setHours(0, 0, 0, 0); 
      const payslips = await salaryModel.find({createdAt: { $gte: start, $lte: end }}).sort({
        createdAt: -1,
    }).populate('staffId');

      // If no salary found
      if (!payslips || payslips.length === 0) {
          return res.status(404).json({ success: false, message: 'No salary found for the given date range' });
      }

      // Return the salary
      res.status(200).json({ success: true, payslips });
    } catch (error) {
        logger.error(error)
      res.status(500).json({ message: 'Server error', error: error.message });
    }
    });


export default router;