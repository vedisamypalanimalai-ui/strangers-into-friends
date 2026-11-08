const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/profile', (req, res) => userController.getProfile(req, res));
router.put('/profile', (req, res) => userController.updateProfile(req, res));
router.get('/search', (req, res) => userController.searchUsers(req, res));
router.get('/random-stranger', (req, res) => userController.getRandomStranger(req, res));

module.exports = router;
