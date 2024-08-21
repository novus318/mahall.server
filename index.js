import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
import path from "path"
import morgan from "morgan"
import connectDB from "./config/db.js"
import authRoutes from './routes/authRoutes.js'
import houseRoutes from './routes/houseRoute.js'
import memberRoutes from './routes/memberRoutes.js'
import bankRoutes from './routes/bankRoutes.js'
import staffRoutes from './routes/staffRoutes.js'
import buildingRoutes from './routes/buildingRoutes.js'


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

app.get('/',(req,res)=>{
  res.send({
      message:'welcome to app itself working for you'
  })
})
app.use('/api/auth',authRoutes)
app.use('/api/house',houseRoutes)
app.use('/api/member',memberRoutes)
app.use('/api/account',bankRoutes)
app.use('/api/staff',staffRoutes)
app.use('/api/rent',buildingRoutes)



app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
