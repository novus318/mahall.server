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
  place: {
    type: String,
    enum: ['UAE', 'Malaysia', 'Kuwait', 'Singapore', 'Kerala','Outside kerala'], // Possible places
    required: true // Ensures that the place field is always set
  }
}, { timestamps: true });

// Export the model
export default mongoose.model('member', memberSchema);
