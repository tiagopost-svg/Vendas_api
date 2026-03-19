const pool = require('../config/db');
const {
  STATUS_VALIDOS,
  TIPOS_VALIDOS,
  buscarClienteResumo,
  criarFollowup,
  listarFollowupsDoUsuario,
} = require('../services/followupService');

const listarFollowups = async (req, res) => {
  const { status = 'pendente', atrasados } = req.query;

  if (status && !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Status de follow-up inválido.' });
  }

  try {
    const dados = await listarFollowupsDoUsuario({
      empresaId: req.user.empresa_id,
      responsavelId: req.user.id,
      status,
      somenteAtrasados: atrasados === 'true',
    });

    return res.status(200).json({ sucesso: true, dados });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const criarNovoFollowup = async (req, res) => {
  const { cliente_id, tipo, referencia_id, data_proxima_acao, mensagem } = req.body;

  if (!cliente_id || !tipo || !referencia_id || !data_proxima_acao || !mensagem) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'cliente_id, tipo, referencia_id, data_proxima_acao e mensagem são obrigatórios.',
    });
  }

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Tipo de follow-up inválido.' });
  }

  try {
    const cliente = await buscarClienteResumo(req.user.empresa_id, cliente_id);
    if (!cliente) {
      return res.status(400).json({ sucesso: false, mensagem: 'Cliente não encontrado para esta empresa.' });
    }

    const followup = await criarFollowup({
      empresaId: req.user.empresa_id,
      clienteId: cliente_id,
      tipo,
      referenciaId: referencia_id,
      dataProximaAcao: data_proxima_acao,
      mensagem,
      responsavelId: req.user.id,
    });

    return res.status(201).json({ sucesso: true, dados: followup });
  } catch (error) {
    return res.status(400).json({ sucesso: false, mensagem: error.message });
  }
};

const atualizarFollowup = async (req, res) => {
  const { id } = req.params;
  const { status = 'concluido' } = req.body;

  if (!['concluido', 'cancelado'].includes(status)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Use status concluido ou cancelado.' });
  }

  try {
    const query = `
      UPDATE follow_ups
      SET status = $1,
          concluido_em = CASE WHEN $1 = 'concluido' THEN CURRENT_TIMESTAMP ELSE concluido_em END
      WHERE id = $2 AND empresa_id = $3 AND responsavel_id = $4
      RETURNING *
    `;
    const { rows } = await pool.query(query, [status, id, req.user.empresa_id, req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Follow-up não encontrado para este usuário.' });
    }

    return res.status(200).json({ sucesso: true, dados: rows[0] });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

module.exports = {
  listarFollowups,
  criarNovoFollowup,
  atualizarFollowup,
};
