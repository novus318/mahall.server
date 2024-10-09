import express  from "express";
import messageModel from "../model/messageModel.js";
import dotenv from 'dotenv'
import axios from "axios";


const router=express.Router()
dotenv.config({ path: '../.env' })
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

const downloadMedia = async (Id) => {
  const url = `https://graph.facebook.com/v16.0/${Id}`;  // WhatsApp media URL
 try{
   const response = await axios.get(url, {
      headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`  // Replace with your access token
      },
  });
  // Convert the binary data to a blob (or buffer)
  if (response.data.url){
    const mediaResponse = await axios.get(response.data.url, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}` // Replace with your access token
      },
      responseType: 'stream', // Handle streaming response
    });
    const chunks = [];
    for await (const chunk of mediaResponse.data) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return buffer;
  } else {
    throw new Error('No media URL found in the response.');
  }
} catch (error) {
  console.error('Error downloading media:', error.message);
  throw error; // Rethrow error if you want to handle it elsewhere
}
};
router.post('/webhook', async (req, res) => {
  try {
      const { entry } = req.body;

      if (entry && entry.length > 0) {
        const changes = entry[0].changes;
        if (changes && changes.length > 0) {
            const messageData = changes[0].value.messages;

            if (messageData && messageData.length > 0) {
                const message = messageData[0];
                let newMessage;

                // Common fields for all messages
                const senderName = changes[0].value.contacts[0].profile.name;
                const senderNumber = message.from;

                switch (message.type) {
                    case 'text':
                        // Handle text message
                        newMessage = new messageModel({
                            senderName,
                            senderNumber,
                            messageContent: message.text.body,
                            messageType: 'text'
                        });
                        break;

                    case 'reaction':
                        // Handle reaction message
                        newMessage = new messageModel({
                            senderName,
                            senderNumber,
                            emoji: message.reaction.emoji,
                            messageType: 'reaction',
                            reactedToMessageId: message.reaction.messsage_id
                        });
                        break;

                        case 'image':
                          // Handle image message, download and save as blob
                          const imageBlob = await downloadMedia(message.image.id);
                          newMessage = new messageModel({
                              senderName,
                              senderNumber,
                              messageContent: message.image.caption,
                              messageType: 'image',
                              mediaBlob: imageBlob,
                              mediaType: message.image.mime_type,
                          });
                          break;

                      case 'sticker':
                          // Handle sticker message, download and save as blob
                          const stickerBlob = await downloadMedia(message.sticker.id);
                          newMessage = new messageModel({
                              senderName,
                              senderNumber,
                              messageType: 'sticker',
                              mediaBlob: stickerBlob,
                              mediaType: message.sticker.mime_type,
                          });
                          break;

                          case 'audio':
                            const audioBlob = await downloadMedia(message.audio.id);
                            newMessage = new messageModel({
                              senderName,
                              senderNumber,
                              messageContent: message.audio.duration,
                              messageType: 'audio',
                              mediaBlob: audioBlob,
                              mediaType: message.audio.mime_type,
                          });
                          break;

                          case 'video':
                            const videoBlob = await downloadMedia(message.video.id);
                            newMessage = new messageModel({
                              senderName,
                              senderNumber,
                              messageContent: message.video.duration,
                              messageType: 'video',
                              mediaBlob: videoBlob,
                              mediaType: message.video.mime_type,
                          });
                          break;
                         
                          case 'document':
                            const documentBlob = await downloadMedia(message.document.id);
                            newMessage = new messageModel({
                              senderName,
                              senderNumber,
                              messageContent: message.document.filename,
                              messageType: 'document',
                              mediaBlob: documentBlob,
                              mediaType: message.document.mime_type,
                          });
                    default:
                        console.log(`Unknown message type: ${message.type}`);
                        break;
                }

                // Save the message to MongoDB
                if (newMessage) {
                    await newMessage.save();
                    console.log('Message saved:', newMessage);
                }
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

router.get('/messages', async (req, res) => {
  try {
    const messages = await messageModel.find().sort({ createdAt: -1 });
    res.json({
      success: true
      ,messages});
  } catch (error) {
    res.status(500).send({
      success: false
     , message: 'Server Error'
     , error: error.message
    });
  }
})
router.get('/media/:id', async (req, res) => {
    const media = await messageModel.findById(req.params.id)
    if (!media) {
      return res.status(404).json({ error: 'Media not found.' });
    }
    res.set('Content-Type', media.mediaType);
    return res.send(media.mediaBlob);  
})

router.delete('/messages/delete', async (req, res) => {
  const { senderName, senderNumber } = req.body;

  try {
      // Ensure senderNumber is provided
      if (!senderNumber) {
          return res.status(400).json({ error: 'Sender number is required.' });
      }

      // Build the query
      const query = { senderNumber };

      // Add senderName to the query if it's provided
      if (senderName) {
          query.senderName = senderName;
      }

      // Delete messages
      const result = await messageModel.deleteMany(query);

      if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'No messages found to delete.' });
      }

      // Return success response
      res.status(200).json({ success:true});
  } catch (error) {
      res.status(500).json({ success:true,error: 'An error occurred while deleting messages.' });
  }
});

router.get('/messages/count', async (req, res) => {
  try {
    const count = await messageModel.countDocuments({});
    res.status(200).json({
      success: true
     , count});
  } catch (error) {
    res.status(500).send({
      success: false
     , message: 'Server Error'
     , error: error.message
    });
  }
})



export default router