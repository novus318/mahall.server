import mongoose from "mongoose";

// Define the schema for a member
const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  DOB: {
    type: Date,
    required: true
  },
  maritalStatus: {
    type: String,
    required: true
  },
  education: {
    type: String,
    required: true
  },
  gender: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
  },
  relation: {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'member', // Reference to another member
    },
    relationType: {
      type: String,
     }
  },
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'house',
    required: true
  },
}, { timestamps: true });

// Export the model
export default mongoose.model('member', memberSchema);
