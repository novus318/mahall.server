import mongoose from "mongoose";

const houseSchema = new mongoose.Schema({
   name: String,
   address: String,
   number: {
      type: String,
      unique: true // This ensures the number is unique
   },
   panchayathNumber: {
      type: String,
   },
   familyHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'member'
   },
   collectionAmount: {
      type: Number,
      default: 0 // You can set a default value if needed
   },
   lastCollection: {
      type: Date,
   },
   status: {
      type: String,
      enum: ['rented', 'owned'], 
      required: true 
   },
   rationsStatus:String,
}, { timestamps: true });

export default mongoose.model('house', houseSchema);
