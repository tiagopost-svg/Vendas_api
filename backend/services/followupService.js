const pool = require('../config/db');

const STATUS_VALIDOS = ['pendente', 'concluido', 'cancelado'];
const TIPOS_VALIDOS = ['orcamento', 'visita', 'venda'];

const MENSAGENS_PADRAO = {
  orcamento_inicial: 'Olá, gostaria de saber se teve alguma dúvida sobre o orçamento.',
  orcamento_reengajamento: 'Olá, passando para saber se podemos avançar com o seu orçamento.',
  visita_sem_orcamento: 'Podemos dar sequência no seu projeto?',
};

const parseDataParaTimestamp = (valor) => {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const buscarClienteResumo = async (empresaId, clienteId, client = pool) => {
  const { rows } = await client.query(
    'SELECT id, nome, telefone FROM clientes WHERE empresa_id = $1 AND id = $2 LIMIT 1',
    [empresaId, clienteId],
  );
  return rows[0] || null;
};

const existeFollowupPendenteNaData = async ({ empresaId, clienteId, tipo, referenciaId, dataProximaAcao }, client = pool) => {
  const { rows } = await client.query(
    `
      SELECT id
      FROM follow_ups
      WHERE empresa_id = $1
        AND cliente_id = $2
        AND tipo = $3
        AND referencia_id = $4
        AND status = 'pendente'
        AND data_proxima_acao = $5
      LIMIT 1
    `,
    [empresaId, clienteId, tipo, referenciaId, dataProximaAcao],
  );

  return rows.length > 0;
};

const criarFollowup = async ({
  empresaId,
  clienteId,
  tipo,
  referenciaId,
  dataProximaAcao,
  mensagem,
  responsavelId,
  status = 'pendente',
}, client = pool) => {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new Error('Tipo de follow-up inválido.');
  }

  if (!STATUS_VALIDOS.includes(status)) {
    throw new Error('Status de follow-up inválido.');
  }

  if (!clienteId || !referenciaId || !dataProximaAcao || !mensagem || !responsavelId) {
    throw new Error('cliente_id, referencia_id, data_proxima_acao, mensagem e responsavel_id são obrigatórios.');
  }

  const dataNormalizada = parseDataParaTimestamp(dataProximaAcao);
  if (!dataNormalizada) {
    throw new Error('data_proxima_acao inválida.');
  }

  const query = `
    INSERT INTO follow_ups (
      empresa_id,
      cliente_id,
      tipo,
      referencia_id,
      data_proxima_acao,
      status,
      mensagem,
      responsavel_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const values = [
    empresaId,
    clienteId,
    tipo,
    referenciaId,
    dataNormalizada,
    status,
    mensagem,
    responsavelId,
  ];

  const { rows } = await client.query(query, values);
  return rows[0];
};

const criarFollowupAutomaticoOrcamento = async ({ empresaId, clienteId, orcamentoId, responsavelId }, client = pool) => {
  const { rows } = await client.query(
    "SELECT (CURRENT_TIMESTAMP + INTERVAL '2 days') AS data_proxima_acao",
    [],
  );
  const dataProximaAcao = rows[0].data_proxima_acao;

  const duplicado = await existeFollowupPendenteNaData({
    empresaId,
    clienteId,
    tipo: 'orcamento',
    referenciaId: orcamentoId,
    dataProximaAcao,
  }, client);

  if (duplicado) {
    return null;
  }

  return criarFollowup({
    empresaId,
    clienteId,
    tipo: 'orcamento',
    referenciaId: orcamentoId,
    dataProximaAcao,
    mensagem: MENSAGENS_PADRAO.orcamento_inicial,
    responsavelId,
  }, client);
};

const criarFollowupAutomaticoVisitaSemOrcamento = async ({ empresaId, clienteId, visitaId, responsavelId }, client = pool) => {
  const { rows } = await client.query(
    "SELECT (CURRENT_TIMESTAMP + INTERVAL '1 day') AS data_proxima_acao",
    [],
  );
  const dataProximaAcao = rows[0].data_proxima_acao;

  const duplicado = await existeFollowupPendenteNaData({
    empresaId,
    clienteId,
    tipo: 'visita',
    referenciaId: visitaId,
    dataProximaAcao,
  }, client);

  if (duplicado) {
    return null;
  }

  return criarFollowup({
    empresaId,
    clienteId,
    tipo: 'visita',
    referenciaId: visitaId,
    dataProximaAcao,
    mensagem: MENSAGENS_PADRAO.visita_sem_orcamento,
    responsavelId,
  }, client);
};

const criarFollowupsPendenciaOrcamento = async (client = pool) => {
  const query = `
    WITH candidatos AS (
      SELECT
        o.id AS referencia_id,
        o.empresa_id,
        o.cliente_id,
        COALESCE(f_base.responsavel_id, primeiro_usuario.id) AS responsavel_id,
        (o.data_criacao::timestamp + INTERVAL '3 days') AS data_proxima_acao
      FROM orcamentos o
      LEFT JOIN LATERAL (
        SELECT responsavel_id
        FROM follow_ups f1
        WHERE f1.empresa_id = o.empresa_id
          AND f1.tipo = 'orcamento'
          AND f1.referencia_id = o.id
        ORDER BY f1.data_criacao ASC
        LIMIT 1
      ) f_base ON true
      LEFT JOIN LATERAL (
        SELECT id
        FROM usuarios u
        WHERE u.empresa_id = o.empresa_id
        ORDER BY u.id ASC
        LIMIT 1
      ) primeiro_usuario ON true
      WHERE o.status = 'pendente'
        AND o.data_criacao <= CURRENT_DATE - INTERVAL '3 days'
        AND NOT EXISTS (
          SELECT 1
          FROM follow_ups f2
          WHERE f2.empresa_id = o.empresa_id
            AND f2.tipo = 'orcamento'
            AND f2.referencia_id = o.id
            AND f2.data_proxima_acao >= (o.data_criacao::timestamp + INTERVAL '3 days')
        )
    )
    INSERT INTO follow_ups (
      empresa_id,
      cliente_id,
      tipo,
      referencia_id,
      data_proxima_acao,
      status,
      mensagem,
      responsavel_id
    )
    SELECT
      empresa_id,
      cliente_id,
      'orcamento',
      referencia_id,
      data_proxima_acao,
      'pendente',
      $1,
      responsavel_id
    FROM candidatos
    WHERE responsavel_id IS NOT NULL
    RETURNING *
  `;

  const { rows } = await client.query(query, [MENSAGENS_PADRAO.orcamento_reengajamento]);
  return rows;
};

const listarFollowupsDoUsuario = async ({ empresaId, responsavelId, status, somenteAtrasados = false }) => {
  const filtros = ['f.empresa_id = $1', 'f.responsavel_id = $2'];
  const valores = [empresaId, responsavelId];

  if (status) {
    filtros.push(`f.status = $${valores.length + 1}`);
    valores.push(status);
  }

  if (somenteAtrasados) {
    filtros.push('f.status = \'pendente\'');
    filtros.push('f.data_proxima_acao < CURRENT_TIMESTAMP');
  }

  const query = `
    SELECT
      f.*,
      c.nome AS cliente_nome,
      c.telefone AS cliente_telefone,
      u.nome AS responsavel_nome,
      (f.data_proxima_acao < CURRENT_TIMESTAMP AND f.status = 'pendente') AS atrasado
    FROM follow_ups f
    INNER JOIN clientes c ON c.id = f.cliente_id AND c.empresa_id = f.empresa_id
    INNER JOIN usuarios u ON u.id = f.responsavel_id AND u.empresa_id = f.empresa_id
    WHERE ${filtros.join(' AND ')}
    ORDER BY f.data_proxima_acao ASC, f.id ASC
  `;

  const { rows } = await pool.query(query, valores);
  return rows;
};

const obterIndicadoresFollowup = async ({ empresaId, responsavelId, limite = 5 }) => {
  const [pendentesResult, atrasadosResult, notificacoesResult] = await Promise.all([
    pool.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM follow_ups
        WHERE empresa_id = $1
          AND responsavel_id = $2
          AND status = 'pendente'
      `,
      [empresaId, responsavelId],
    ),
    pool.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM follow_ups
        WHERE empresa_id = $1
          AND responsavel_id = $2
          AND status = 'pendente'
          AND data_proxima_acao < CURRENT_TIMESTAMP
      `,
      [empresaId, responsavelId],
    ),
    pool.query(
      `
        SELECT
          f.id,
          f.tipo,
          f.mensagem,
          f.data_proxima_acao,
          c.nome AS cliente_nome,
          c.telefone AS cliente_telefone,
          (f.data_proxima_acao < CURRENT_TIMESTAMP) AS atrasado
        FROM follow_ups f
        INNER JOIN clientes c ON c.id = f.cliente_id AND c.empresa_id = f.empresa_id
        WHERE f.empresa_id = $1
          AND f.responsavel_id = $2
          AND f.status = 'pendente'
        ORDER BY (f.data_proxima_acao < CURRENT_TIMESTAMP) DESC, f.data_proxima_acao ASC
        LIMIT $3
      `,
      [empresaId, responsavelId, limite],
    ),
  ]);

  return {
    pendentes: Number(pendentesResult.rows[0]?.total || 0),
    atrasados: Number(atrasadosResult.rows[0]?.total || 0),
    notificacoes: notificacoesResult.rows,
  };
};

const processarFollowupsPendentes = async () => {
  const novosFollowups = await criarFollowupsPendenciaOrcamento();
  const { rows } = await pool.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM follow_ups
      WHERE status = 'pendente'
        AND data_proxima_acao <= CURRENT_TIMESTAMP
    `,
  );

  return {
    totalPendentesParaAcao: Number(rows[0]?.total || 0),
    novosFollowupsGerados: novosFollowups.length,
  };
};

module.exports = {
  STATUS_VALIDOS,
  TIPOS_VALIDOS,
  MENSAGENS_PADRAO,
  buscarClienteResumo,
  criarFollowup,
  criarFollowupAutomaticoOrcamento,
  criarFollowupAutomaticoVisitaSemOrcamento,
  criarFollowupsPendenciaOrcamento,
  listarFollowupsDoUsuario,
  obterIndicadoresFollowup,
  processarFollowupsPendentes,
};
