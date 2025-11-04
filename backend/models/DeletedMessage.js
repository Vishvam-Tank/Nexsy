import mongoose from "mongoose";

const deletedMessageSchema = new mongoose.Schema({
  originalMessage: Object,
  deletedAt: Date,
});

export default mongoose.model("DeletedMessage", deletedMessageSchema);
