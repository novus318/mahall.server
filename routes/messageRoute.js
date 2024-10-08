import express  from "express";
import messageModel from "../model/messageModel.js";
const router=express.Router()


const downloadMedia = async (mediaId) => {
  const mediaUrl = `https://your_media_url/${mediaId}`; // WhatsApp Media URL
  const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary');  // Convert to blob
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
                  const timestamp = message.timestamp;

                  switch (message.type) {
                      case 'text':
                          // Handle text message
                          newMessage = new messageModel({
                              senderName,
                              senderNumber,
                              messageContent: message.text.body,
                              messageType: 'text',
                              timestamp
                          });
                          break;

                      case 'reaction':
                          // Handle reaction message
                          newMessage = new messageModel({
                              senderName,
                              senderNumber,
                              emoji: message.reaction.emoji,
                              messageType: 'reaction',
                              reactedToMessageId: message.reaction.messsage_id,
                              timestamp
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
                                timestamp
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
                                timestamp
                            });
                            break;

                      // Handle other media types similarly (audio, video, etc.)
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
      console.error('Error processing message:', error,req.body.entry);
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