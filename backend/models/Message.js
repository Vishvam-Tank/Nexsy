import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  username: String,
  text: String,
  time: String,
});

export default mongoose.model("Message", messageSchema);
