import { generateMonthlySalaries } from "../functions/generateSalary.js";

export default async function handler(req, res) {
    try {
        await generateMonthlySalaries();
    console.log('generateMonthlySalaries executed successfully');
      res.status(200).send(
        'Salary generated successfully for the 1st of every month at 10 AM'
      );
    } catch (error) {
        console.error('Error in generateMonthlySalaries:', error);
      res.status(500).send('Error in generating salary');
    }
  }