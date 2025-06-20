const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
  from: String,        // your email
  to: String,          // friend name or email
  date: String,
  time: String,
  place: String,
  message: String
});

module.exports = mongoose.model("Invite", InviteSchema);
