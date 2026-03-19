const express = require('express');
const { login, me } = require('../controllers/authController');
const { protegerRotas } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.get('/me', protegerRotas, me);

module.exports = router;
