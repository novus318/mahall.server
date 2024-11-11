import mongoose from "mongoose";

// Define a subdocument schema for education
const educationSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['Below 10th', 'SSLC', 'Plus Two', 'Diploma', 'Bachelors', 'Masters', 'PhD'],
    required: true
  },
  description: {
    type: String,
  }
});

// Define a subdocument schema for Madrassa
const madrassaSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['Not studied','Below 5th', 'Above 5th', 'Above 10th'],
    required: true
  },
  description: {
    type: String,
  }
});

// Define the schema for a member
const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
  },
  DOB: {
    type: Date,
  },
  maritalStatus: {
    type: String,
  },
  education: educationSchema, 
  madrassa: madrassaSchema, 
  gender: {
    type: String,
  },
  mobile: {
    type: String,
  },
  whatsappNumber:{
    type: String,
  },
  relation: {
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'member',
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
  },
  idCards: {
    aadhaar: {
      type: Boolean,
    },
    drivingLicense: {
      type: Boolean,
    },
    voterID: {
      type: Boolean,
    },
    panCard: {
      type: Boolean,
    },
    HealthCard:{
      type: Boolean,
    }
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-','NIL'],
    required: true
  }
}, { timestamps: true });

// Export the model
export default mongoose.model('member', memberSchema);
