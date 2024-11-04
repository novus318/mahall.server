import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const router = express.Router();

const dataFilePath = path.join(process.cwd(), 'data', 'number.json');

async function readNumbers() {
    const fileContents = await fs.readFile(dataFilePath, 'utf-8');
    return JSON.parse(fileContents);
}

// Helper function to write numbers to the JSON file
async function writeNumbers(numbers) {
    await fs.writeFile(dataFilePath, JSON.stringify(numbers, null, 2));
}


router.get('/get-numbers', async (req, res) => {
    try {
        const numbers = await readNumbers();
        res.status(200).json(numbers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve numbers' });
    }
});


router.post('/add-number', async (req, res) => {
    try {
        const { newNumber, newName } = req.body;

        // Validate input
        if (!newNumber || typeof newNumber !== 'string' || !newName || newName.trim() === '') {
            return res.status(400).json({ message: 'Invalid input' });
        }

        // Ensure newNumber is exactly 10 digits
        if (newNumber.length !== 10 || isNaN(Number(newNumber))) {
            return res.status(400).json({ message: 'Phone number must be a 10-digit string' });
        }

        const numbers = await readNumbers();

        // Create new number object
        const newNumberObject = { id: Date.now(), name: newName, number: newNumber };
        numbers.push(newNumberObject);

        await writeNumbers(numbers);

        res.status(200).json({ message: 'Number added successfully', newNumberObject });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to add number' });
    }
});

// PUT - Update an existing number
router.put('/update-number', async (req, res) => {
    try {
        const { id, newNumber, newName } = req.body;

        // Validate input
        if (!id || !newNumber || typeof newNumber !== 'string' || !newName || newName.trim() === '') {
            return res.status(400).json({ message: 'Invalid input' });
        }

        // Ensure newNumber is exactly 10 digits
        if (newNumber.length !== 10 || isNaN(Number(newNumber))) {
            return res.status(400).json({ message: 'Phone number must be a 10-digit string' });
        }

        const numbers = await readNumbers();

        // Find the index of the number to update
        const index = numbers.findIndex(num => num.id === id);
        if (index === -1) {
            return res.status(404).json({ message: 'Number not found' });
        }

        // Update number
        numbers[index] = { ...numbers[index], name: newName, number: newNumber };

        await writeNumbers(numbers);

        res.status(200).json({ message: 'Number updated successfully', updatedNumber: numbers[index] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update number' });
    }
});

// DELETE - Delete a number
router.delete('/delete-number', async (req, res) => {
    try {
        const { id } = req.body;

        const numbers = await readNumbers();

        // Filter out the number to delete
        const updatedNumbers = numbers.filter(num => num.id !== id);

        if (numbers.length === updatedNumbers.length) {
            return res.status(404).json({ message: 'Number not found' });
        }

        await writeNumbers(updatedNumbers);

        res.status(200).json({ message: 'Number deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete number' });
    }
});

export default router;