// 📁 File: server/server.js

// ✅ Always load .env first
require('dotenv').config();

console.log("👉 MONGO_URI from .env:", process.env.MONGO_URI);


const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
app.use(cors());

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const User = require('./models/user');
const Invite = require('./models/invite');

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('docs'));
app.use(express.static(path.join(__dirname, '../docs')));


// ✅ Debug: Check if Mongo URI is loading
console.log("✅ MONGO_URI is:", process.env.MONGO_URI);

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.log('❌ DB error: ' + err));

// ✅ Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ✅ Signup Route
app.post('/signup', async (req, res) => {
  const { name, email, password, birthday } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      birthday,
      friends: []
    });

    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Signup failed', error: err });
  }
});

// ✅ Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.json({ token, user: { name: user.name, email: user.email, birthday: user.birthday } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err });
  }
});

// ✅ Add Friend Route
app.post('/add-friend', async (req, res) => {
  const { userEmail, friendEmail } = req.body;

  try {
    const user = await User.findOne({ email: userEmail });
    const friend = await User.findOne({ email: friendEmail });

    if (!user || !friend) return res.status(404).json({ message: 'User or friend not found' });

    if (user.friends.includes(friendEmail)) {
      return res.status(400).json({ message: 'Friend already added' });
    }

    user.friends.push(friendEmail);
    await user.save();

    res.json({ message: 'Friend added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding friend', error: err });
  }
});

// ✅ Get Friends List
app.get('/friends', async (req, res) => {
  const { email } = req.query;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const friends = await User.find({ email: { $in: user.friends } }, 'name email birthday');
    res.json(friends);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friends', error: err });
  }
});

// ✅ Send & Save Invite
app.post('/send-invite', async (req, res) => {
  const { from, to, date, time, place, message } = req.body;
  try {
    const invite = new Invite({ from, to, date, time, place, message });
    await invite.save();

    // OPTIONAL: Send email to the friend
    /*
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: '🎉 You Are Invited!',
      text: `You are invited by ${from} to a birthday on ${date} at ${time}, ${place}.
${message ? `\n\nMessage: ${message}` : ''}`
    });
    */

    res.json({ message: 'Invite saved!' });
  } catch (err) {
    res.status(500).json({ message: 'Error saving invite', error: err });
  }
});

// ✅ Cron Job: Send Birthday Reminder Emails Every Day at Midnight
cron.schedule('0 0 * * *', async () => {
  console.log('🎂 Running birthday reminder job...');
  try {
    const users = await User.find();
    const today = new Date().toISOString().slice(5, 10); // Format: MM-DD

    for (const user of users) {
      const friends = await User.find({ email: { $in: user.friends } });
      const birthdaysToday = friends.filter(f => f.birthday.slice(5, 10) === today);

      if (birthdaysToday.length > 0) {
        const names = birthdaysToday.map(f => f.name).join(', ');

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: '🎉 Birthday Alert!',
          text: `Hey ${user.name}, today is ${names}'s birthday! 🎂\n\nMake sure to send them your wishes!`
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Sent birthday email to ${user.email}`);
      }
    }
  } catch (err) {
    console.error('❌ Error running birthday cron:', err);
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
