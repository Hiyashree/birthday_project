// 📁 File: server/server.js

// ✅ Always load .env first
require('dotenv').config();

console.log("👉 MONGO_URI from .env:", process.env.MONGO_URI);


const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const User = require('./models/user');
const Invite = require('./models/invite');
const FriendRequest = require('./models/friendRequest');

const app = express();


// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('docs'));
app.use(express.static(path.join(__dirname, '../docs')));
app.use(cors({
  origin: 'https://hiyashree.github.io', // your frontend domain
  credentials: true
}));



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
  try {
    console.log("📩 Login data:", req.body);  // Debug: Show incoming data

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found:", email); // Debug: user not found
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Password incorrect for:", email); // Debug: wrong password
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '2h' });

    console.log("✅ Login successful for:", email); // Debug: success
    res.json({ token, user: { name: user.name, email: user.email, birthday: user.birthday } });

  } catch (err) {
    console.error("💥 Login error:", err); // 👉 ACTUAL error to Render logs
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});


// ✅ Send Friend Request (instead of instant add)
app.post('/friend-request', async (req, res) => {
  const { fromEmail, toEmail } = req.body;

  try {
    const fromUser = await User.findOne({ email: fromEmail });
    const toUser = await User.findOne({ email: toEmail });

    if (!fromUser || !toUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (fromUser._id.equals(toUser._id)) {
      return res.status(400).json({ message: 'You cannot send a request to yourself' });
    }

    // prevent duplicate pending requests
    const existingReq = await FriendRequest.findOne({
      from: fromUser._id,
      to: toUser._id,
      status: 'pending'
    });
    if (existingReq) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    // also check if already friends
    const alreadyFriend = fromUser.friends.some(
      f => f.friend && f.friend.equals(toUser._id) && f.status === 'accepted'
    );
    if (alreadyFriend) {
      return res.status(400).json({ message: 'You are already friends' });
    }

    const fr = new FriendRequest({ from: fromUser._id, to: toUser._id });
    await fr.save();

    res.json({ message: 'Friend request sent' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending friend request', error: err });
  }
});

// ✅ Get incoming friend requests for a user
app.get('/friend-requests', async (req, res) => {
  const { email } = req.query;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const requests = await FriendRequest.find({
      to: user._id,
      status: 'pending'
    }).populate('from', 'name email');

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friend requests', error: err });
  }
});

// ✅ Accept or reject a friend request
app.post('/friend-request/respond', async (req, res) => {
  const { requestId, action } = req.body; // 'accept' or 'reject'

  try {
    const request = await FriendRequest.findById(requestId).populate('from to');
    if (!request || request.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid or already handled request' });
    }

    if (action === 'accept') {
      request.status = 'accepted';

      // add each other as friends
      request.from.friends.push({ friend: request.to._id, status: 'accepted' });
      request.to.friends.push({ friend: request.from._id, status: 'accepted' });

      await request.from.save();
      await request.to.save();
    } else if (action === 'reject') {
      request.status = 'rejected';
    } else {
      return res.status(400).json({ message: 'Unknown action' });
    }

    await request.save();

    res.json({ message: `Friend request ${action}ed` });
  } catch (err) {
    res.status(500).json({ message: 'Error responding to friend request', error: err });
  }
});

// ✅ Get Friends List (using new friends schema)
app.get('/friends', async (req, res) => {
  const { email } = req.query;

  try {
    const user = await User.findOne({ email }).populate('friends.friend', 'name email birthday');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const acceptedFriends = user.friends
      .filter(f => f.status === 'accepted' && f.friend)
      .map(f => f.friend);

    res.json(acceptedFriends);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friends', error: err });
  }
});

// ✅ Simple user search (by name or email)
app.get('/search-users', async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim() === '') {
    return res.json([]);
  }

  try {
    const users = await User.find(
      {
        $or: [
          { email: { $regex: q, $options: 'i' } },
          { name: { $regex: q, $options: 'i' } }
        ]
      },
      'name email birthday'
    );

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error searching users', error: err });
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
