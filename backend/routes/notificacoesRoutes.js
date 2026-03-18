const express = require('express');
const { listarNotificacoes, marcarComoLida } = require('../controllers/notificacoesController');
const { protegerRotas } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protegerRotas);
router.get('/', listarNotificacoes);
router.put('/:id/lida', marcarComoLida);

module.exports = router;
