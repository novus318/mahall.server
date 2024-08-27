import axios from 'axios';
import { google } from 'googleapis';
import puppeteer from 'puppeteer';
import { Readable } from 'stream';

import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

const generateReceiptHTML = (collection) => {
    const { category, amount, date, description, memberId, houseId, status, PaymentDate, kudiCollectionType } = collection;
  
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { width: 80%; margin: auto; }
          .header { text-align: center; padding: 20px; }
          .header h1 { margin: 0; }
          .receipt-details { margin: 20px 0; }
          .receipt-details table { width: 100%; border-collapse: collapse; }
          .receipt-details th, .receipt-details td { padding: 8px; border: 1px solid #ddd; }
          .receipt-details th { background-color: #f4f4f4; }
          .footer { text-align: center; margin-top: 20px; }
          .footer p { margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Receipt</h1>
            <p>Category: ${category.name}</p>
            <p>Description: ${category.description}</p>
          </div>
          <div class="receipt-details">
            <table>
              <tr>
                <th>Amount</th>
                <td>${amount}</td>
              </tr>
              <tr>
                <th>Date</th>
                <td>${new Date(date).toLocaleDateString()}</td>
              </tr>
              <tr>
                <th>Description</th>
                <td>${description}</td>
              </tr>
              <tr>
                <th>Member Name</th>
                <td>${memberId.name}</td>
              </tr>
              <tr>
                <th>House Name</th>
                <td>${houseId.name}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td>${status}</td>
              </tr>
              <tr>
                <th>Payment Date</th>
                <td>${new Date(PaymentDate).toLocaleDateString()}</td>
              </tr>
              <tr>
                <th>Kudi Collection Type</th>
                <td>${kudiCollectionType}</td>
              </tr>
            </table>
          </div>
          <div class="footer">
            <p>Thank you for your payment!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };
  
export const generatePDF = async (collection) => {
    const html = generateReceiptHTML(collection);
    
    // Launch puppeteer and generate PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    const pdfBuffer = await page.pdf({ format: 'A5' });
  
    await browser.close();
  
    return pdfBuffer;
  };

  const arrayBufferToBuffer = (arrayBuffer) => {
    return Buffer.from(new Uint8Array(arrayBuffer));
};


export const saveFileToDrive = async (file,fileName) => {
    try {
        // Ensure file.buffer is a Buffer
        const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : arrayBufferToBuffer(file.buffer);

        // Load Google Drive API credentials from environment variables
        const credentials = {
            type: process.env.GOOGLE_DRIVE_TYPE,
            project_id: process.env.GOOGLE_DRIVE_PROJECT_ID,
            private_key_id: process.env.GOOGLE_DRIVE_PRIVATE_KEY_ID,
            private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
            client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
            auth_uri: process.env.GOOGLE_DRIVE_AUTH_URI,
            token_uri: process.env.GOOGLE_DRIVE_TOKEN_URI,
            auth_provider_x509_cert_url: process.env.GOOGLE_DRIVE_AUTH_PROVIDER_X509_CERT_URL,
            client_x509_cert_url: process.env.GOOGLE_DRIVE_CLIENT_X509_CERT_URL,
        };

        // Create a new JWT client
        const jwtClient = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key,
            ['https://www.googleapis.com/auth/drive']
        );

        // Authenticate with the Google Drive API
        await jwtClient.authorize();

        // Create a Google Drive API client
        const drive = google.drive({ version: 'v3', auth: jwtClient });

        // Check if 'mahall' folder exists
        const mahallFolderList = await drive.files.list({
            q: "name='mahall' and mimeType='application/vnd.google-apps.folder'",
            fields: 'files(id)',
        });
        let mahallFolderId = mahallFolderList.data.files[0]?.id;

        // If 'mahall' folder doesn't exist, create it
        if (!mahallFolderId) {
            const mahallFolderMetadata = {
                name: 'mahall',
                mimeType: 'application/vnd.google-apps.folder',
            };
            const mahallFolder = await drive.files.create({
                requestBody: mahallFolderMetadata,
                fields: 'id',
            });
            mahallFolderId = mahallFolder.data.id;
        }

        // Check if 'collectionReciept' folder exists inside 'mahall'
        const collectionRecieptFolderList = await drive.files.list({
            q: `name='collectionReciept' and '${mahallFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
            fields: 'files(id)',
        });
        let collectionRecieptFolderId = collectionRecieptFolderList.data.files[0]?.id;

        // If 'collectionReciept' folder doesn't exist inside 'mahall', create it
        if (!collectionRecieptFolderId) {
            const collectionRecieptFolderMetadata = {
                name: 'collectionReciept',
                mimeType: 'application/vnd.google-apps.folder',
                parents: [mahallFolderId],
            };
            const collectionRecieptFolder = await drive.files.create({
                requestBody: collectionRecieptFolderMetadata,
                fields: 'id',
            });
            collectionRecieptFolderId = collectionRecieptFolder.data.id;
        }

        // Convert buffer to readable stream
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);

        // Upload the file to Google Drive
        const fileMetadata = {
            name: fileName,
            parents: [collectionRecieptFolderId],
        };
        const media = {
            body: bufferStream,
        };

        const uploadedFile = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        // Get the file ID and generate the shareable link
        const fileId = uploadedFile.data.id;
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });
        const fileUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        return fileUrl;
    } catch (error) {
        console.error('Error saving file to Google Drive:', error);
        throw error;
    }
};


