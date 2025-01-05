import mongoose from 'mongoose'
import colors from 'colors'
import logger from '../utils/logger.js'
const connectDB =async()=>{
    try{
        const conn= await mongoose.connect(process.env.MONGO_URL)
        logger.info(`Connection established with ${conn.connection.host}`.bgGreen.white)
    }catch(error){
        logger.error(`Connection failed: ${error}`.bgRed.white)
    }
}
export default connectDB