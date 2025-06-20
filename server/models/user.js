// 📁 File: server/models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  birthday: String,
  friends: [String] // for storing friend's email or IDs
});

module.exports = mongoose.model('User', UserSchema);
