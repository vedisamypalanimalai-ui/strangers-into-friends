require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const socketService = require('./services/socketService');
const googleSheetsService = require('./services/googleSheetsService');

// Route Handlers
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const friendRoutes = require('./routes/friendRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
socketService.init(io);

// Security & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows inline scripts & external avatar SVGs seamlessly
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(__dirname));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

// Health Check API
app.get('/api/health', async (req, res) => {
  try {
    const pingResult = await googleSheetsService.callAppsScript('ping');
    res.json({
      status: 'healthy',
      platform: 'STRANGERS INTO FRIENDS',
      tagline: 'Meet Strangers. Make Friends. Share Feelings.',
      database: pingResult,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'degraded', error: err.message });
  }
});

// HTML Page Route Helpers for clean URL access
const pages = [
  'index', 'signup', 'login', 'dashboard', 'chat',
  'profile', 'friends', 'settings', 'admin'
];

pages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
});

// Catch-all route to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auto-seed Default Admin on Startup
async function bootstrapAdmin() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@strangersintofriends.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePass2026!';
    
    const existing = await googleSheetsService.findUserByUsernameOrEmail(adminEmail);
    if (!existing) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(adminPassword, salt);

      await googleSheetsService.createUser({
        userId: uuidv4(),
        fullName: 'Platform Superadmin',
        username: 'superadmin',
        mobile: '+1000000000',
        email: adminEmail,
        passwordHash: hash,
        dateOfBirth: '1995-01-01',
        gender: 'Other',
        bio: 'Strangers Into Friends Platform Administrator',
        location: 'HQ',
        profilePicture: 'https://ui-avatars.com/api/?name=Admin&background=2563eb&color=fff&bold=true',
        role: 'admin'
      });
      console.log(`🛡️  [Bootstrap]: Created initial Admin account: ${adminEmail}`);
    } else {
      console.log(`🛡️  [Bootstrap]: Admin account confirmed (${adminEmail}).`);
    }
  } catch (err) {
    console.error('Bootstrap admin check notice:', err.message);
  }
}

// Start Server
server.listen(PORT, async () => {
  console.log('================================================================');
  console.log('✨ STRANGERS INTO FRIENDS - REAL-TIME CHAT PLATFORM IS RUNNING ✨');
  console.log(`🚀 Server listening on: http://localhost:${PORT}`);
  console.log('💬 Tagline: "Meet Strangers. Make Friends. Share Feelings."');
  console.log('📊 Database: Google Sheets (via Google Apps Script API Bridge)');
  console.log('================================================================');
  await bootstrapAdmin();
});

module.exports = { app, server };
