const express = require('express');
const {
  criarVisita,
  listarVisitas,
  buscarVisitaPorId,
  excluirVisita,
} = require('../controllers/visitasController');
const { protegerRotas } = require('../middlewares/authMiddleware');
const { uploadVisitas } = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(protegerRotas);
router.post('/', uploadVisitas, criarVisita);
router.get('/', listarVisitas);
router.get('/:id', buscarVisitaPorId);
router.delete('/:id', excluirVisita);

module.exports = router;
