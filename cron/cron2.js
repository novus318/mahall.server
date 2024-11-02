import { collectRent } from "../functions/generateRent.js";

export default async function handler(req, res) {
    try {
        await collectRent();
        console.log('collectRent executed successfully');
      res.status(200).send(
        'Rent collected successfully for the 3rd of every month at 10 AM'
      );
    } catch (error) {
        console.error('Error in collectRent:', error);
      res.status(500).send('Error in collecting rent');
    }
  }