const express = require('express');
const {
  listarOrcamentos,
  buscarOrcamentoPorId,
  criarOrcamento,
  atualizarOrcamento,
  excluirOrcamento,
  converterOrcamentoEmVenda,
} = require('../controllers/orcamentosController');
const { protegerRotas } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protegerRotas);
router.post('/', criarOrcamento);
router.get('/', listarOrcamentos);
router.get('/:id', buscarOrcamentoPorId);
router.put('/:id', atualizarOrcamento);
router.delete('/:id', excluirOrcamento);
router.post('/:id/convert', converterOrcamentoEmVenda);

module.exports = router;
