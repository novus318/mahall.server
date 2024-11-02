import { generateMonthlyCollections } from "../functions/generateMonthlyCollections.js";
import { generateMonthlySalaries } from "../functions/generateSalary.js";

export default async function handler(req, res) {
    try {
      await generateMonthlyCollections();
      await generateMonthlySalaries(); // Your function logic
      console.log('generateMonthlyCollections and generateMonthlySalaries executed successfully');
      res.status(200).send(
        'Collections and salary generated successfully for the 1st and 1st of every month at 10 AM'
      );
    } catch (error) {
      console.error('Error in generateMonthlyCollections:', error);
      res.status(500).send('Error in generateMonthlyCollections');
    }
  }