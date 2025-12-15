// 📁 File: server/models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  birthday: String,

  // 🌟 Profile-like fields to make the app feel more "social"
  profilePic: String, // URL to avatar image
  bio: String,        // short about-me text
  location: String,   // city / country

  // 🌟 Friends are now stored as references with a status
  friends: [{
    friend: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' }
  }]
});

module.exports = mongoose.model('User', UserSchema);
