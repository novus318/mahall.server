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
    required: function() {
      return ['Below 10th', 'Diploma', 'Bachelors', 'Masters'].includes(this.level);
    }
  }
});

// Define a subdocument schema for Madrassa
const madrassaSchema = new mongoose.Schema({
  studying: {
    type: Boolean, // Whether the person is currently studying
    required: true
  },
  currentClass: {
    type: String,
    required: function() {
      return this.studying; // Required if the person is currently studying
    }
  },
  lastClassStudied: {
    type: String,
    required: function() {
      return !this.studying; // Required if the person is not studying
    }
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
  education: educationSchema, // Use the education subdocument schema here
  madrassa: madrassaSchema, // Use the madrassa subdocument schema here
  gender: {
    type: String,
    required: true
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
    enum: ['UAE', 'Malaysia', 'Kuwait', 'Singapore', 'Kerala', 'Outside Kerala'], // Possible places
    required: true // Ensures that the place field is always set
  },
  idCards: {
    aadhaar: {
      type: Boolean,
      required: true
    },
    drivingLicense: {
      type: Boolean,
      required: true
    },
    voterID: {
      type: Boolean,
      required: true
    },
    panCard: {
      type: Boolean,
      required: true
    },
    HealthCard:{
      type: Boolean,
      required: true
    }
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  }
}, { timestamps: true });

// Export the model
export default mongoose.model('member', memberSchema);
