import express from "express"
import Razorpay from 'razorpay';
import dotenv from 'dotenv'
import crypto from 'crypto';
import logger from "../utils/logger.js";


dotenv.config({ path: './.env' })

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const router = express.Router()

const validateWebhookSignature = (payload, signature, secret) => {
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return generatedSignature === signature;
};

router.post("/razorpay",async(req,res) => {
    const signature = req.headers["x-razorpay-signature"];
       const isValid = await validateWebhookSignature(
          JSON.stringify(req.body),
          signature,
          RAZORPAY_WEBHOOK_SECRET
        );
        const webData = JSON.stringify(req.body);
        logger.error(webData)
     if (isValid) {
          const { event, payload } = req.body;
         logger.error(req.body)
          switch (event) {
            case "payment.authorized":
              console.log(payload);
              break;
            case "payment.captured":
                logger.error(payload);
              break;
            case "payment.failed":
                console.log(payload);
              break;
            default:
              // console.log(`Unhandled event: ${event}`);
              break;
          }
        }
       res.status(200).send(
        "Webhook received and validated successfully"
       );
      
    })






export default router;
