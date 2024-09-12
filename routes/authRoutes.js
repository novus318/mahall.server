import express  from "express";
import jwt from "jsonwebtoken";
import PasswordModel from "../model/PasswordModel.js";
const router=express.Router()



router.post('/login', async(req, res) => {
    const { pin,user } = req.body;
    const { JWT_SECRET } = process.env;
    try {
    
        // Find user by username
        const userName = await PasswordModel.findOne({ user:user });
        if (!userName) {
            return res.status(401).send({ success: false, message: "User not found" });
        }
    // Verify the pin
    if (pin === userName.passkey) {
        // Generate JWT token valid for 1 week
        const token = jwt.sign({ pin }, JWT_SECRET, { expiresIn: '7d' });


        res.status(200).send({ success: true, token });
    } else {
        res.status(401).send({ success: false, message: 'Invalid PIN' });
    }
}
    catch (error) {
        res.status(500).send({ success: false, message: 'Server Error', error: error.message });
}});


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

// Password Reset Route
router.post("/reset-password", async (req, res) => {
    const { username, newPassword } = req.body;

    try {
        // Find user by username
        const user = await PasswordModel.findOne({ user:username });
        if (!user) {
            return res.status(404).send({ success: false, message: "User not found" });
        }

        user.passkey = newPassword;
        await user.save();

        res.status(200).send({ success: true, message: "Password reset successfully" });
    } catch (error) {
        res.status(500).send({ success: false, message: "Server error" });
    }
});

router.post("/register", async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if user already exists
        const existingUser = await PasswordModel.findOne({ user:username });
        if (existingUser) {
            console.log(existingUser)
            return res.status(400).send({ success: false, message: "Username already taken" });
        }

        // Create new user
        const newUser = new PasswordModel({ user:username, passkey: password });
        const data = await newUser.save();

        res.status(201).send({ success: true, message: "User registered successfully",data });
    } catch (error) {
        res.status(500).send({ success: false, message: "Server error" });
    }
});


export default router