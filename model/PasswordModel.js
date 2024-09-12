import mongoose from "mongoose";

const passwordSchema = new mongoose.Schema({
    user:{
        type: String,
        required: true,
    },
    passkey: {
        type: String,
        required: true,
    },
},{ timestamps: true });

export default mongoose.model('checkers', passwordSchema);

