# STRANGERS INTO FRIENDS 💬✨
> **Tagline:** *"Meet Strangers. Make Friends. Share Feelings."*

A complete, modern, responsive, real-time chatting platform built with a high-performance **Node.js + Express + Socket.IO** backend, vanilla **HTML5 + CSS3 + JavaScript** frontend, and **Google Sheets** (via Google Apps Script Web App API bridge) as its exclusive permanent database.

---

## 🌟 Highlights & Features

- **Exclusive Google Sheets Database**: All users, messages, conversations, friend requests, friendships, notifications, blocks, moderation reports, sessions, and platform settings are permanently stored across 10 Google Sheets tabs.
- **Real-Time Communication**: Instant one-to-one messaging powered by **Socket.IO** with typing indicators, double checkmark read receipts, online/offline presence indicators, and audio alerts.
- **Premium Dark Aesthetics**: Styled with deep black/grey glassmorphism (`#0a0b10`, `#151824`), purple (`#8b5cf6`) and blue (`#3b82f6`) neon gradient highlights, smooth animations, and responsive mobile-first views.
- **Robust Authentication**:
  - Full Name, unique Username, unique Email, Mobile Number, bcrypt Password hashing, Date of Birth (strict 18+ age gate), Gender, and customizable Profile Picture.
  - Session and JWT token authentication.
  - Forgot password and reset flow.
- **Friends & Community Engine**:
  - Global user search with instant suggestions.
  - Send, accept, or decline friend requests.
  - Live online friends carousel and dedicated friend list.
  - **"Meet a Stranger"** 1-click random icebreaker finder.
  - 1-click User Blocking and Moderation Reporting.
- **Rich Chat Features**:
  - Real-time text messaging.
  - Integrated emoji picker with 90+ emojis.
  - Media/image attachments.
  - Message deletion (delete for me / delete for everyone).
  - Conversation history automatically reloaded on login.
- **Dedicated Secure Admin Panel**:
  - Real-time platform statistics (Total Registered, Active Users, Live Sockets, Total Messages, Reports).
  - User management (search, suspend, activate).
  - Moderation review system for abuse reports.
  - Platform settings control (Maintenance Mode, Registration toggle).
  - **Zero Password Exposure**: Passwords and password hashes are never displayed.

---

## 🗄️ Google Sheets Database Structure (10 Tabs)

Your Google Spreadsheet holds 10 dedicated sheets. Column headers are automatically created by `Code.gs` when you run `setupDatabase()` or make an initial setup request:

### 1. `Users`
| Column Header | Type | Description |
|---|---|---|
| `UserID` | String (UUID) | Unique identifier for user |
| `FullName` | String | User's full display name |
| `Username` | String | Unique username (lowercase) |
| `Mobile` | String | Validated phone number |
| `Email` | String | Unique email address (lowercase) |
| `PasswordHash` | String | Salted bcrypt password hash |
| `DateOfBirth` | String (YYYY-MM-DD) | Birthdate (18+ verified) |
| `Gender` | String | User gender |
| `Bio` | String | Profile bio text |
| `Location` | String | City or country |
| `ProfilePicture` | String | Image URL or avatar data |
| `Role` | String | `'user'` or `'admin'` |
| `Status` | String | `'active'` or `'suspended'` |
| `CreatedAt` | ISO Timestamp | Account registration time |
| `LastLogin` | ISO Timestamp | Last sign-in time |

### 2. `Messages`
| Column Header | Type | Description |
|---|---|---|
| `MessageID` | String (UUID) | Unique message ID |
| `ConversationID` | String | e.g. `conv_<user1>_<user2>` |
| `SenderID` | String | UserID of sender |
| `ReceiverID` | String | UserID of receiver |
| `MessageType` | String | `'text'`, `'image'`, or `'emoji'` |
| `Content` | String | Message text or image URL |
| `Timestamp` | ISO Timestamp | Send time |
| `Status` | String | `'sent'`, `'delivered'`, `'read'`, `'deleted'` |
| `DeletedFor` | String | `'none'`, `'sender'`, `'receiver'`, `'both'` |

### 3. `Conversations`
| Column Header | Type | Description |
|---|---|---|
| `ConversationID` | String | Canonical conversation ID |
| `User1ID` | String | Participant 1 |
| `User2ID` | String | Participant 2 |
| `LastMessageID` | String | Last message ID |
| `LastMessageContent`| String | Snippet of last message |
| `LastMessageTimestamp`| ISO Timestamp | Time of last message |
| `UnreadCountUser1` | Number | Unread count for User 1 |
| `UnreadCountUser2` | Number | Unread count for User 2 |
| `CreatedAt` | ISO Timestamp | Conversation initiation time |
| `UpdatedAt` | ISO Timestamp | Last activity timestamp |

### 4. `FriendRequests`
| Column Header | Type | Description |
|---|---|---|
| `RequestID` | String (UUID) | Unique request ID |
| `SenderID` | String | Requester UserID |
| `ReceiverID` | String | Target UserID |
| `Status` | String | `'pending'`, `'accepted'`, `'rejected'` |
| `CreatedAt` | ISO Timestamp | Request time |
| `UpdatedAt` | ISO Timestamp | Response time |

### 5. `Friends`
| Column Header | Type | Description |
|---|---|---|
| `FriendshipID` | String (UUID) | Friendship relation ID |
| `User1ID` | String | First friend |
| `User2ID` | String | Second friend |
| `Status` | String | `'active'` or `'unfriended'` |
| `CreatedAt` | ISO Timestamp | Friendship establishment time |

### 6. `Notifications`
| Column Header | Type | Description |
|---|---|---|
| `NotificationID` | String (UUID) | Unique notification ID |
| `UserID` | String | Recipient UserID |
| `Type` | String | `'friend_request'`, `'request_accepted'`, `'message'` |
| `Title` | String | Notification headline |
| `Body` | String | Notification text body |
| `Link` | String | Target relative URL |
| `IsRead` | String | `'true'` or `'false'` |
| `CreatedAt` | ISO Timestamp | Creation time |

### 7. `BlockedUsers`
| Column Header | Type | Description |
|---|---|---|
| `BlockID` | String (UUID) | Unique block ID |
| `BlockerID` | String | User who performed block |
| `BlockedID` | String | User who was blocked |
| `Reason` | String | Reason for block |
| `CreatedAt` | ISO Timestamp | Block timestamp |

### 8. `Reports`
| Column Header | Type | Description |
|---|---|---|
| `ReportID` | String (UUID) | Unique report ID |
| `ReporterID` | String | User who filed report |
| `ReportedUserID` | String | User being reported |
| `Reason` | String | Violation category |
| `Details` | String | Specific details/evidence |
| `Status` | String | `'pending'`, `'reviewed'`, `'dismissed'`, `'action_taken'` |
| `AdminNotes` | String | Moderator notes |
| `CreatedAt` | ISO Timestamp | Report timestamp |
| `UpdatedAt` | ISO Timestamp | Last reviewed timestamp |

### 9. `Sessions`
| Column Header | Type | Description |
|---|---|---|
| `SessionID` | String (UUID) | Unique session ID |
| `UserID` | String | Authenticated UserID |
| `Token` | String | Session or JWT hash |
| `IPAddress` | String | Client IP address |
| `UserAgent` | String | Client browser/device |
| `CreatedAt` | ISO Timestamp | Login time |
| `ExpiresAt` | ISO Timestamp | Expiration timestamp |
| `IsValid` | String | `'true'` or `'false'` |

### 10. `Settings`
| Column Header | Type | Description |
|---|---|---|
| `Key` | String | Setting name (e.g. `PlatformName`, `MaintenanceMode`) |
| `Value` | String | Setting value |
| `Description` | String | Human readable description |
| `UpdatedAt` | ISO Timestamp | Last update time |

---

## 📁 Complete Folder Structure

```
strangers-into-friends-source/
├── server.js                     # Express app & Socket.IO server initialization
├── package.json                  # Dependencies & scripts
├── .env                          # Active environment variables
├── .env.example                  # Template environment file
├── Code.gs                       # Google Apps Script database code (root mirror)
│
├── google-apps-script/
│   └── Code.gs                   # Google Apps Script Web App source code
│
├── middleware/
│   ├── authMiddleware.js         # JWT & session authentication verification
│   ├── adminMiddleware.js        # Strict administrator role protection
│   ├── rateLimiter.js            # Brute-force & DDoS rate limiting
│   └── validation.js             # 18+ birthdate, email, phone, XSS input sanitization
│
├── controllers/
│   ├── authController.js         # Register, Login, Logout, Forgot & Reset Password
│   ├── userController.js         # Profile, Search, Random Stranger Matcher
│   ├── chatController.js         # Conversations, Messaging, Read status, Media upload
│   ├── friendController.js       # Friends list, Requests, Block & Report handlers
│   ├── adminController.js        # Dashboard statistics, User moderation, Reports
│   └── settingsController.js     # Password updates, Notifications preferences
│
├── routes/
│   ├── authRoutes.js             # /api/auth
│   ├── userRoutes.js             # /api/users
│   ├── chatRoutes.js             # /api/chat
│   ├── friendRoutes.js           # /api/friends
│   ├── adminRoutes.js            # /api/admin
│   └── settingsRoutes.js         # /api/settings
│
├── services/
│   ├── googleSheetsService.js    # Google Apps Script API client & Local DB bridge
│   └── socketService.js          # Socket.IO presence, rooms & event dispatcher
│
├── data/
│   └── localDatabase.json        # Out-of-the-box local storage fallback & cache
│
├── public/                       # Frontend application assets & pages
│   ├── index.html                # 1. Landing page with hero & features
│   ├── signup.html               # 2. Registration form (18+ verified)
│   ├── login.html                # 3. User login & password recovery
│   ├── dashboard.html            # 4. User dashboard & stranger finder
│   ├── chat.html                 # 5. Real-time 1-on-1 chat interface
│   ├── profile.html              # 6. Profile viewer & profile editor
│   ├── friends.html              # 7. Friends list, online status & discovery
│   ├── settings.html             # 8. Account & security settings
│   ├── admin.html                # 9. Secure administrative panel
│   │
│   ├── css/
│   │   ├── style.css             # Theme variables, typography & layout reset
│   │   ├── components.css        # Buttons, inputs, badges, modals, toasts
│   │   └── pages.css             # Specialized chat bubbles, cards, grids
│   │
│   ├── js/
│   │   ├── api.js                # Unified REST API client
│   │   ├── socket-client.js      # Socket.IO client & audio chimes
│   │   ├── utils.js              # Toasts, time formatters, XSS escape
│   │   ├── auth.js               # Sign up, sign in, reset password logic
│   │   ├── dashboard.js          # Dashboard counters, stranger modal
│   │   ├── chat.js               # Chat messaging, emojis, media, typing
│   │   ├── friends.js            # Friend actions & tabs
│   │   ├── profile.js            # Profile updates & public visitor mode
│   │   ├── settings.js           # Security & notification toggles
│   │   └── admin.js              # Admin statistics, moderation & controls
│   │
│   └── uploads/                  # Uploaded chat images
│
└── tests/
    └── testSuite.js              # Automated end-to-end integration test suite
```

---

## 🚀 Step-by-Step Installation & Setup Guide

### Step 1: Clone or Navigate to Project
```bash
cd strangers-into-friends-source
```

### Step 2: Install Node.js Dependencies
```bash
npm install
```

### Step 3: Set Up Google Sheets & Google Apps Script

1. Go to [Google Sheets](https://sheets.new) and create a **new blank spreadsheet**.
2. Name your spreadsheet **"STRANGERS INTO FRIENDS DATABASE"**.
3. In the top menu, click **Extensions** → **Apps Script**.
4. In the Apps Script editor, open the default `Code.gs` file and replace its entire contents with the code inside [`google-apps-script/Code.gs`](file:///c:/Users/LOQ/Downloads/strangers-into-friends-source/google-apps-script/Code.gs).
5. In the top toolbar function selector, select `setupDatabase` and click **Run**.
   - Approve the standard Google permission prompts when requested.
   - The script will automatically create all **10 tabs** (`Users`, `Messages`, `Conversations`, `FriendRequests`, `Friends`, `Notifications`, `BlockedUsers`, `Reports`, `Sessions`, `Settings`) formatted with bold headers!
6. Click the blue **Deploy** button (top right) → **New deployment**.
   - Click the gear icon next to "Select type" and select **Web app**.
   - **Description**: `Strangers Into Friends API Bridge`
   - **Execute as**: `Me (your Google email)`
   - **Who has access**: `Anyone` *(Note: This allows your Node.js backend to make API POST calls to the script)*
   - Click **Deploy**.
7. Copy the generated **Web App URL** (e.g. `https://script.google.com/macros/s/AKfycb.../exec`).

### Step 4: Configure Environment Variables

Open or create the `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development

# Authentication Secrets
JWT_SECRET=sif_jwt_super_secret_key_8f3d9a1c6e4b2d7e_2026
SESSION_SECRET=sif_session_vault_key_9b2e7a4c1f8d6e3a

# Google Sheets Web App Endpoint
GOOGLE_SCRIPT_WEBAPP_URL=https://script.google.com/macros/s/PASTE_YOUR_DEPLOYED_URL_HERE/exec
GOOGLE_SCRIPT_API_SECRET=SIF_SECURE_API_SECRET_2026_CHANGE_IN_PRODUCTION

# Set to true for offline local testing, or false to use live Google Sheets
USE_LOCAL_MOCK_DB=false

# Default Superadmin Credentials
ADMIN_EMAIL=admin@strangersintofriends.com
ADMIN_PASSWORD=AdminSecurePass2026!
```

> **Instant Local Testing Note**: If you haven't deployed the Google Apps Script yet, set `USE_LOCAL_MOCK_DB=true` in `.env`. The backend includes a built-in local JSON database engine (`data/localDatabase.json`) that mimics the exact 10 Google Sheets tabs so you can develop and test immediately offline without errors!

---

## 💻 Localhost Testing Instructions

1. **Start the Node.js Server**:
   ```bash
   npm start
   ```

2. **Open in Your Web Browser**:
   - Landing Page: [http://localhost:3000](http://localhost:3000)
   - Sign Up: [http://localhost:3000/signup.html](http://localhost:3000/signup.html)
   - Sign In: [http://localhost:3000/login.html](http://localhost:3000/login.html)
   - Dashboard: [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html)
   - Real-Time Chat: [http://localhost:3000/chat.html](http://localhost:3000/chat.html)
   - Friends: [http://localhost:3000/friends.html](http://localhost:3000/friends.html)
   - Profile: [http://localhost:3000/profile.html](http://localhost:3000/profile.html)
   - Settings: [http://localhost:3000/settings.html](http://localhost:3000/settings.html)
   - Admin Panel: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

3. **Admin Login**:
   - Email: `admin@strangersintofriends.com`
   - Password: `AdminSecurePass2026!`

4. **Testing Real-Time 1-on-1 Chat**:
   - Open two browser windows (or one normal window and one Incognito window).
   - Register User 1 (e.g. `alice_w`).
   - Register User 2 (e.g. `bob_d`).
   - In Alice's window, search for `bob_d` or click **"Meet a Stranger"** and send a Friend Request.
   - In Bob's window, accept the request on the Dashboard or Friends page.
   - Open **Chat** in both windows:
     - Type messages in real-time.
     - Observe real-time message delivery without page reloads.
     - Watch typing indicators appear as the other user types.
     - Notice sent checkmarks (`✓`) change to blue double checkmarks (`✓✓`) upon reading.
     - Test attaching images and sending emojis.
     - Delete a message for everyone and observe it remove on both screens.

5. **Run the Automated Test Suite**:
   ```bash
   node tests/testSuite.js
   ```
   *Runs comprehensive E2E validation verifying registration, authentication, friend requests, real-time messaging, admin operations, and all 9 HTML views.*

---

## 🌐 Production Deployment Guide

### Option 1: Deploy on Render / Railway
1. Push your repository to GitHub or GitLab.
2. In [Render](https://render.com) or [Railway](https://railway.app), create a new **Web Service**.
3. Connect your repository.
4. Set build & start settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. In the **Environment Variables** panel, add the variables from your `.env` file (including `GOOGLE_SCRIPT_WEBAPP_URL` and `JWT_SECRET`).
6. Deploy! Your real-time chat website will be live with full SSL/HTTPS and WebSocket support.

### Option 2: Deploy on VPS (Ubuntu / Debian with PM2 & Nginx)
1. Install Node.js (v18+) and PM2:
   ```bash
   npm install -g pm2
   ```
2. Start the application with PM2:
   ```bash
   pm2 start server.js --name "strangers-into-friends"
   pm2 save
   pm2 startup
   ```
3. Configure Nginx as a reverse proxy with WebSocket upgrade support:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
4. Obtain a free SSL certificate with Certbot:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

---

## 🛡️ Security Implementation Summary

- **Bcrypt Password Hashes**: 10-round salted hashes are generated before any user data is saved. Plain text passwords are never stored anywhere.
- **Admin Isolation**: Admin routes are secured by `authMiddleware` and `adminMiddleware`. Admin dashboard endpoints never send password hashes or sensitive tokens.
- **Cross-Site Scripting (XSS)**: Inputs are strictly sanitized and HTML-encoded before being rendered to the DOM.
- **Rate Limiting**: `express-rate-limit` prevents brute force on login, registration, and reset endpoints.
- **Zero Exposed Secrets**: Google Apps Script private endpoints and JWT keys are strictly contained inside Node.js environment variables and never surfaced to frontend client scripts.

---

## 📄 License
MIT License. Created for the **STRANGERS INTO FRIENDS** community.
#   s t r a n g e r s - t o - f r i e n d s  
 #   S t r a n g e r s - t o - f r i e n d s  
 #   S t r a n g e r s - t o - f r i e n d s  
 #   S t r a n g e r s - t o - f r i e n d s  
 