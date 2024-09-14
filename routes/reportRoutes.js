import express  from "express";
import BankModel from "../model/BankModel.js";

const router=express.Router()

router.get('/dashboard', async (req, res) => {
    const assets = await BankModel.find();

    const totalBalance = assets.reduce((sum, asset) => sum + asset.balance, 0);
    const data = [
        { title: "Tuition Fees", link: 'Tution'},
        { title: "Rent" ,link: 'rent'},
        { title: "Payments", link: 'payments'},
        { title: "Receipts",  link: 'reciept'},
        { title: "Accounts", value: `₹${totalBalance}`, link: 'Accounts'},
        { title: "Members", value: "9,012" ,link: 'members'},
        { title: "Staff",  value: "98",link: 'staff'},
      ]
    res.send({
        success:true,
        data:data
    });
});


export default router;