import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
import morgan from "morgan"
import cron from 'node-cron';
import connectDB from "./config/db.js"
import authRoutes from './routes/authRoutes.js'
import houseRoutes from './routes/houseRoute.js'
import memberRoutes from './routes/memberRoutes.js'
import bankRoutes from './routes/bankRoutes.js'
import staffRoutes from './routes/staffRoutes.js'
import buildingRoutes from './routes/buildingRoutes.js'
import transactionRoutes from './routes/transactionRoutes.js'
import { generateMonthlyCollections } from "./functions/generateMonthlyCollections.js"
// import { generateMonthlySalaries } from "./functions/generateSalary.js"
import { collectRent } from "./functions/generateRent.js"
import dashboardRoutes from './routes/dashboardRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import recieptRoutes from './routes/recieptRoutes.js'
import messageRoutes from './routes/messageRoute.js'
import settingRoutes from './routes/settingRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import adminRoute from './routes/adminRoute.js'
import razorpayRoute from './routes/razorpayRoute.js'
import webhookRoute from './routes/webhookRoute.js'
import generateRecieptPDF from './routes/receiptPDFRoute.js'
import logger from "./utils/logger.js"
// import { generateMonthlySample } from "./functions/send-sample.js"
// import { generateYearlyCollectionForSingleHouse, generateYearlyCollections } from "./functions/generateYearlyCollection.js"
// import { generateMonthlySample2 } from "./functions/send-sample.js"



const app = express();
const PORT = 8000;
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
}));
dotenv.config({ path: './.env' })

// Middleware to parse JSON bodies
app.use(express.json())
app.use(morgan('dev'))

//database configcon
connectDB();

//  generateMonthlySample2()
// await generateYearlyCollectionForSingleHouse('2025', '100');
// generateYearlyCollections()
//  generateMonthlyCollections()
//  generateMonthlySalaries()
// collectRent()

// Schedule generateMonthlyCollections() for the 5th of every month at 2 AM
cron.schedule('0 2 5 * *', async () => {
  try {
    await generateMonthlyCollections();
    console.log('generateMonthlyCollections executed successfully');
  } catch (error) {
    console.error('Error in generateMonthlyCollections:', error);
  }
},
{
  timezone: "Asia/Kolkata" 
});

// cron.schedule('0 10 2 * *', async () => {
//   try {
//     await generateMonthlySalaries();
//     console.log('generateMonthlySalaries executed successfully');
//   } catch (error) {
//     console.error('Error in generateMonthlySalaries:', error);
//   }
// },
// {
//   timezone: "Asia/Kolkata"
// });

// Schedule collectRent() for the 25th of every month at 2 AM
cron.schedule('0 2 25 * *', async () => {
  try {
    await collectRent();
    console.log('collectRent executed successfully');
  } catch (error) {
    console.error('Error in collectRent:', error);
  }
},
{
  timezone: "Asia/Kolkata" // Setting timezone to IST
});


app.get('/server/api',(req,res)=>{
  res.send({
      message:'welcome to app itself working for you'
  })
})

app.use('/server/api/auth',authRoutes)
app.use('/server/api/dashboard',dashboardRoutes)
app.use('/server/api/house',houseRoutes)
app.use('/server/api/member',memberRoutes)
app.use('/server/api/account',bankRoutes)
app.use('/server/api/staff',staffRoutes)
app.use('/server/api/rent',buildingRoutes)
app.use('/server/api/transactions',transactionRoutes)
app.use('/server/api/pay',paymentRoutes)
app.use('/server/api/reciept',recieptRoutes)
app.use('/server/api/message',messageRoutes)
app.use('/server/api/setting',settingRoutes)
app.use('/server/api/reports',reportRoutes)
app.use('/server/api/admin',adminRoute)
app.use('/server/api/razorpay',razorpayRoute)
app.use('/server/api/webhook',webhookRoute)
app.use('/server/api/pdf/:id',generateRecieptPDF)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Error handling request: ${JSON.stringify(err.stack || err)}`);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});
