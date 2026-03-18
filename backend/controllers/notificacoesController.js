const {
  contarNotificacoesNaoLidas,
  listarNotificacoesDoUsuario,
  marcarNotificacaoComoLida,
} = require('../services/notificacaoService');

const listarNotificacoes = async (req, res) => {
  const somenteNaoLidas = String(req.query.nao_lidas || 'false').toLowerCase() === 'true';
  const { limit } = req.query;

  try {
    const [notificacoes, naoLidas] = await Promise.all([
      listarNotificacoesDoUsuario({
        empresaId: req.user.empresa_id,
        usuarioId: req.user.id,
        limit,
        somenteNaoLidas,
      }),
      contarNotificacoesNaoLidas({
        empresaId: req.user.empresa_id,
        usuarioId: req.user.id,
      }),
    ]);

    return res.status(200).json({
      sucesso: true,
      dados: notificacoes,
      resumo: {
        nao_lidas: naoLidas,
      },
    });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

const marcarComoLida = async (req, res) => {
  try {
    const notificacao = await marcarNotificacaoComoLida({
      empresaId: req.user.empresa_id,
      usuarioId: req.user.id,
      notificacaoId: req.params.id,
    });

    if (!notificacao) {
      return res.status(404).json({ sucesso: false, mensagem: 'Notificação não encontrada para este usuário.' });
    }

    return res.status(200).json({ sucesso: true, dados: notificacao });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

module.exports = {
  listarNotificacoes,
  marcarComoLida,
};
