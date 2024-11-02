import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
import path from "path"
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
import { generateMonthlySalaries } from "./functions/generateSalary.js"
import { collectRent } from "./functions/generateRent.js"
import dashboardRoutes from './routes/dashboardRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import recieptRoutes from './routes/recieptRoutes.js'
import messageRoutes from './routes/messageRoute.js'
import settingRoutes from './routes/settingRoutes.js'
import reportRoutes from './routes/reportRoutes.js'

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

 // generateMonthlyCollections()
// generateMonthlySalaries()
// collectRent()

cron.schedule('0 10 1 * *', async () => {
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

cron.schedule('0 10 2 * *', async () => {
  try {
    await generateMonthlySalaries();
    console.log('generateMonthlySalaries executed successfully');
  } catch (error) {
    console.error('Error in generateMonthlySalaries:', error);
  }
},
{
  timezone: "Asia/Kolkata"
});

// Schedule collectRent() for the 3rd of every month at 10 AM
cron.schedule('0 10 3 * *', async () => {
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


cron.schedule('10 11 2 * *', async () => {
  console.log("Running generateMonthlySalaries at", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
  try {
    await generateMonthlySalaries();
    console.log('generateMonthlySalaries executed successfully');
  } catch (error) {
    console.error('Error in generateMonthlySalaries:', error);
  }
}, {
  timezone: "Asia/Kolkata" // Setting timezone to IST
});

app.get('/',(req,res)=>{
  res.send({
      message:'welcome to app itself working for you'
  })
})

app.use('/api/auth',authRoutes)
app.use('/api/dashboard',dashboardRoutes)
app.use('/api/house',houseRoutes)
app.use('/api/member',memberRoutes)
app.use('/api/account',bankRoutes)
app.use('/api/staff',staffRoutes)
app.use('/api/rent',buildingRoutes)
app.use('/api/transactions',transactionRoutes)
app.use('/api/pay',paymentRoutes)
app.use('/api/reciept',recieptRoutes)
app.use('/api/message',messageRoutes)
app.use('/api/setting',settingRoutes)
app.use('/api/reports',reportRoutes)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
