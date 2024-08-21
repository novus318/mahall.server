import mongoose from "mongoose";


const rentCollectionSchema = new mongoose.Schema({
    period: { type: String, required: true },
    amount: { type: Number, required: true },
    advancePayment: { type: Number, required: false },
    paymentDate: { type: Date, required: true },
    status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  }, { timestamps: true });



const tenantSchema = new mongoose.Schema({
    aadhaar: { type: String, required: true },
    name: { type: String, required: true },
    number: { type: String, required: true },
    place: { type: String, required: true },
  });
  
  const contractSchema = new mongoose.Schema({
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    tenant: { type: tenantSchema, required: true },
    rent: { type: Number, required: true },
    deposit: { type: Number, required: true },
    rentCollection: [rentCollectionSchema],
  }, { timestamps: true });
  
  const roomSchema = new mongoose.Schema({
    roomNumber: { type: String, required: true },
    contractHistory: [contractSchema],
  }, { timestamps: true });
  
  const buildingSchema = new mongoose.Schema({
    buildingName: { type: String, required: true },
    place: { type: String, required: true },
    buildingID: { type: String, required: true, unique: true },
    rooms: [roomSchema],
  }, { timestamps: true });
  

export default mongoose.model('building', buildingSchema);
