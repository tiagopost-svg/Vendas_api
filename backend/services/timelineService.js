const pool = require('../config/db');

const LIMIT_PADRAO = 50;
const LIMIT_MAXIMO = 100;

const parseLimit = (valor) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    return LIMIT_PADRAO;
  }
  return Math.min(numero, LIMIT_MAXIMO);
};

const buscarClienteResumo = async (empresaId, clienteId) => {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM clientes
      WHERE empresa_id = $1 AND id = $2
      LIMIT 1
    `,
    [empresaId, clienteId],
  );

  return rows[0] || null;
};

const criarEventoTimeline = ({ id, tipo, descricao, data, destaque = false, extra = {} }) => ({
  id,
  tipo,
  descricao,
  data,
  destaque,
  extra,
});

const montarTimelineCliente = async ({ empresaId, clienteId, limit }) => {
  const cliente = await buscarClienteResumo(empresaId, clienteId);

  if (!cliente) {
    throw new Error('Cliente não encontrado para esta empresa.');
  }

  const [visitasResult, orcamentosResult, vendasResult, followupsResult] = await Promise.all([
    pool.query(
      `
        SELECT id, data_visita, tipo_visita, observacoes, resultado, imagem_desenho_url, imagem_local_url
        FROM visitas
        WHERE empresa_id = $1 AND cliente_id = $2
      `,
      [empresaId, clienteId],
    ),
    pool.query(
      `
        SELECT id, descricao, valor, status, data_criacao, atualizado_em, data_validade
        FROM orcamentos
        WHERE empresa_id = $1 AND cliente_id = $2
      `,
      [empresaId, clienteId],
    ),
    pool.query(
      `
        SELECT id, valor, status, forma_pagamento, data_venda, criado_em, orcamento_id
        FROM vendas
        WHERE empresa_id = $1 AND cliente_id = $2
      `,
      [empresaId, clienteId],
    ),
    pool.query(
      `
        SELECT id, tipo, referencia_id, data_criacao, data_proxima_acao, status, mensagem, concluido_em
        FROM follow_ups
        WHERE empresa_id = $1 AND cliente_id = $2
      `,
      [empresaId, clienteId],
    ),
  ]);

  const eventos = [
    criarEventoTimeline({
      id: `cliente-${cliente.id}`,
      tipo: 'cliente',
      descricao: 'Cliente criado',
      data: cliente.criado_em,
      extra: {
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        cidade: cliente.cidade,
        status_pipeline: cliente.status_pipeline,
      },
    }),
    ...visitasResult.rows.map((visita) => criarEventoTimeline({
      id: `visita-${visita.id}`,
      tipo: 'visita',
      descricao: 'Visita realizada',
      data: visita.data_visita,
      extra: {
        imagem_url: visita.imagem_desenho_url,
        imagem_local_url: visita.imagem_local_url,
        observacoes: visita.observacoes,
        resultado: visita.resultado,
        tipo_visita: visita.tipo_visita,
      },
    })),
    ...orcamentosResult.rows.flatMap((orcamento) => {
      const eventosOrcamento = [
        criarEventoTimeline({
          id: `orcamento-criado-${orcamento.id}`,
          tipo: 'orcamento',
          descricao: 'Orçamento criado',
          data: orcamento.data_criacao,
          extra: {
            valor: orcamento.valor,
            status: orcamento.status,
            descricao: orcamento.descricao,
            data_validade: orcamento.data_validade,
          },
        }),
      ];

      if (orcamento.atualizado_em && new Date(orcamento.atualizado_em).getTime() > new Date(orcamento.data_criacao).getTime() + 1000) {
        eventosOrcamento.push(
          criarEventoTimeline({
            id: `orcamento-atualizado-${orcamento.id}`,
            tipo: 'orcamento',
            descricao: 'Orçamento atualizado',
            data: orcamento.atualizado_em,
            extra: {
              valor: orcamento.valor,
              status: orcamento.status,
              descricao: orcamento.descricao,
              data_validade: orcamento.data_validade,
            },
          }),
        );
      }

      return eventosOrcamento;
    }),
    ...vendasResult.rows.map((venda) => criarEventoTimeline({
      id: `venda-${venda.id}`,
      tipo: 'venda',
      descricao: 'Venda realizada',
      data: venda.data_venda || venda.criado_em,
      destaque: true,
      extra: {
        valor: venda.valor,
        status: venda.status,
        forma_pagamento: venda.forma_pagamento,
        orcamento_id: venda.orcamento_id,
      },
    })),
    ...followupsResult.rows.flatMap((followup) => {
      const eventosFollowup = [
        criarEventoTimeline({
          id: `followup-criado-${followup.id}`,
          tipo: 'followup',
          descricao: 'Follow-up criado',
          data: followup.data_criacao,
          extra: {
            mensagem: followup.mensagem,
            status: followup.status,
            data_proxima_acao: followup.data_proxima_acao,
            referencia_id: followup.referencia_id,
            origem: followup.tipo,
          },
        }),
      ];

      if (followup.concluido_em) {
        eventosFollowup.push(
          criarEventoTimeline({
            id: `followup-concluido-${followup.id}`,
            tipo: 'followup',
            descricao: 'Follow-up concluído',
            data: followup.concluido_em,
            extra: {
              mensagem: followup.mensagem,
              status: followup.status,
              referencia_id: followup.referencia_id,
              origem: followup.tipo,
            },
          }),
        );
      }

      return eventosFollowup;
    }),
  ];

  const timeline = eventos
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, parseLimit(limit));

  return {
    cliente,
    timeline,
  };
};

module.exports = {
  montarTimelineCliente,
};
