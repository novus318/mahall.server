import mongoose from "mongoose";


const rentCollectionSchema = new mongoose.Schema({
    period: { type: String, required: true },
    amount: { type: Number, required: true },
    PaymentAmount: { type: Number },
    date: {
      type: Date,
      default: Date.now
  },
  onleave:{
    days: { type: Number },
    deductAmount: { type: Number } 
  },
  advanceDeduction: { type: Number, default: 0 },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'bank', 
},
    paymentDate: { type: Date},
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Online'], 
      default: 'Cash'
  },
  paidAmount: {
    type: Number,
    default: 0
},
  partialPayments: [{
    amount: {
        type: Number,
        required: true
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    description: {
        type: String,
    }
}],
    status: { type: String, enum: ['Pending', 'Paid','Rejected','Partial'], default: 'Pending' },
  }, { timestamps: true });



  
  const depositTransactionSchema = new mongoose.Schema({
    amount: { 
        type: Number,
    },
    transactionType: { 
        type: String, 
        enum: ['Paid', 'Returned'], 
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Online'], 
        default: 'Cash'
    },
    paymentDate: { 
        type: Date, 
        default: Date.now 
    },
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
    shop:{type:String},
    rent: { type: Number, required: true },
    deposit: { type: Number},
    advancePayment:{
      type: Number,
      default: 0,
    },
    depositStatus: { type: String, enum: ['Pending', 'Paid', 'ReturnPending', 'Returned'], default: 'Pending' },
    status: { type: String, enum: ['active','rejected', 'inactive'], default: 'active' },
    rentCollection: [rentCollectionSchema],
    depositCollection:[depositTransactionSchema]
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
