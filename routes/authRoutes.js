import express  from "express";
import jwt from "jsonwebtoken";
const router=express.Router()



router.post('/login', (req, res) => {
    const { pin } = req.body;
    const { LOGIN_PIN, JWT_SECRET } = process.env;

    // Verify the pin
    if (pin === LOGIN_PIN) {
        // Generate JWT token valid for 1 week
        const token = jwt.sign({ pin }, JWT_SECRET, { expiresIn: '7d' });

        // Send back the token
        res.status(200).send({ success: true, token });
    } else {
        // Invalid pin
        res.status(401).send({ success: false, message: 'Invalid PIN' });
    }
});
router.post('/verify', (req, res) => {
const { token } = req.body;
const { JWT_SECRET } = process.env;

// Verify the token
jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
        // Token is invalid or expired
        return res.status(401).send({ success: false, message: 'Invalid or expired token' });
    }

    // Token is valid, you can access the decoded payload if needed
    res.status(200).send({ success: true, decoded });
});
});



export default router