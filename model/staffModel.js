import mongoose from "mongoose";

const statusSchema = new mongoose.Schema({
  status: { type: String, enum: ['Active', 'Inactive', 'On Leave'], required: true },
  startDate: { type: Date, required: true }, 
  endDate: { type: Date }, 
});

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true }, 
  age:{
    type: Number,
    required: true,
  }, 
  employeeId: { type: String, required: true, unique: true },
  department: { type: String, required: true },
  position: { type: String, required: true },
  salary: { type: Number, required: true },
  joinDate: { type: Date, default: Date.now },
  firstSalary:{
    type: Number,
    required: true,
  },
  advancePay: { type: Number, default: 0 },
  contactInfo: {
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: String,
  },
  statusHistory: [statusSchema], // Array to store status changes over time
},
{ timestamps: true });

export default mongoose.model('staff', staffSchema);
