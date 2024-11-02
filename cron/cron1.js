import { generateMonthlyCollections } from "../functions/generateMonthlyCollections.js";

export default async function handler(req, res) {
    try {
      await generateMonthlyCollections(); // Your function logic
      console.log('generateMonthlyCollections executed successfully');
      res.status(200).send('generateMonthlyCollections executed successfully');
    } catch (error) {
      console.error('Error in generateMonthlyCollections:', error);
      res.status(500).send('Error in generateMonthlyCollections');
    }
  }