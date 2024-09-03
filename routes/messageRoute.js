import express  from "express";
import messageModel from "../model/messageModel.js";
const router=express.Router()



router.post('/webhook', async (req, res) => {
    try {
        const { entry } = req.body;

        if (entry && entry.length > 0) {
            const changes = entry[0].changes;
            if (changes && changes.length > 0) {
                const messageData = changes[0].value.messages;

                if (messageData && messageData.length > 0) {
                    const message = messageData[0];

                    // Save the message to MongoDB
                    const newMessage = new messageModel({
                        senderNumber: message.from,
                        messageContent: message.text.body, // assuming it's a text message
                        messageType: message.type,
                    });

                    await newMessage.save();

                    console.log('Message saved:', changes[0].value.contacts[0].profile.name);
                }
            }
        }

        res.sendStatus(200); // Acknowledge the request
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).send('Internal Server Error');
    }
});


router.get('/webhook', async (req, res) => {
  let mode=req.query['hub.mode']
  let token=req.query['hub.verify_token']
  let challenge=req.query['hub.challenge']

  const mytoken='nizam'
  if(mode && token){
    if(mode=='subscribe' && token===mytoken){
      res.status(200).send(challenge)
    }else{
      res.sendStatus(403)
    }
  }
})



export default router