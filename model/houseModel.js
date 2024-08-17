import mongoose from "mongoose";

const houseSchema = new mongoose.Schema({
   name: String,
   address: String,
   number:String,
   familyHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'member'
    },
    collectionAmount: {
      type: Number,
      default: 0 // You can set a default value if needed
    }
},{ timestamps: true });

export default mongoose.model('house', houseSchema);
  // Reference to the family head (also a member)