const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

// Multer storage for image attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are allowed.'));
  }
});

router.use(authMiddleware);

router.get('/conversations', (req, res) => chatController.getConversations(req, res));
router.post('/conversations', (req, res) => chatController.startConversation(req, res));
router.get('/conversations/:conversationId/messages', (req, res) => chatController.getMessages(req, res));
router.post('/messages', (req, res) => chatController.sendMessage(req, res));
router.delete('/messages/:messageId', (req, res) => chatController.deleteMessage(req, res));
router.post('/upload', upload.single('image'), (req, res) => chatController.uploadImage(req, res));

module.exports = router;
