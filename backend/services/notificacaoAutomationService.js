const pool = require('../config/db');
const {
  buscarUsuariosDaEmpresa,
  criarNotificacao,
  criarNotificacoesParaUsuarios,
} = require('./notificacaoService');

let automationStarted = false;

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(valor || 0));

const gerarNotificacoesFollowupAtrasado = async (client = pool) => {
  const { rows } = await client.query(
    `
      SELECT f.id, f.empresa_id, f.responsavel_id, f.data_proxima_acao, f.mensagem, c.nome AS cliente_nome
      FROM follow_ups f
      INNER JOIN clientes c ON c.id = f.cliente_id AND c.empresa_id = f.empresa_id
      WHERE f.status = 'pendente'
        AND f.data_proxima_acao < CURRENT_TIMESTAMP
    `,
  );

  const criadas = await Promise.all(rows.map((followup) => criarNotificacao({
    empresaId: followup.empresa_id,
    usuarioId: followup.responsavel_id,
    tipo: 'followup',
    titulo: 'Follow-up atrasado',
    mensagem: `${followup.cliente_nome} está com follow-up vencido desde ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(followup.data_proxima_acao))}.`,
    referenciaId: followup.id,
    referenciaTipo: 'followup',
    prioridade: 'alta',
  }, client)));

  return criadas.filter(Boolean).length;
};

const gerarNotificacoesVisitaDoDia = async (client = pool) => {
  const { rows } = await client.query(
    `
      SELECT v.id, v.empresa_id, v.data_visita, c.nome AS cliente_nome
      FROM visitas v
      INNER JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
      WHERE v.data_visita = CURRENT_DATE
    `,
  );

  let total = 0;

  for (const visita of rows) {
    const criadas = await criarNotificacoesParaUsuarios({
      empresaId: visita.empresa_id,
      tipo: 'visita',
      titulo: 'Visita do dia',
      mensagem: `Hoje há uma visita programada para ${visita.cliente_nome}.`,
      referenciaId: visita.id,
      referenciaTipo: 'visita',
      prioridade: 'media',
    }, client);

    total += criadas.length;
  }

  return total;
};

const gerarNotificacoesVisitaAtrasada = async (client = pool) => {
  const { rows } = await client.query(
    `
      SELECT v.id, v.empresa_id, v.data_visita, c.nome AS cliente_nome
      FROM visitas v
      INNER JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
      WHERE v.data_visita < CURRENT_DATE
        AND v.resultado = 'retorno'
    `,
  );

  let total = 0;

  for (const visita of rows) {
    const criadas = await criarNotificacoesParaUsuarios({
      empresaId: visita.empresa_id,
      tipo: 'visita',
      titulo: 'Visita atrasada',
      mensagem: `A visita de ${visita.cliente_nome} ficou pendente de retorno após a data ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(visita.data_visita))}.`,
      referenciaId: visita.id,
      referenciaTipo: 'visita',
      prioridade: 'alta',
    }, client);

    total += criadas.length;
  }

  return total;
};

const gerarNotificacoesOrcamentoSemResposta = async (client = pool) => {
  const { rows } = await client.query(
    `
      SELECT o.id, o.empresa_id, o.valor, c.nome AS cliente_nome
      FROM orcamentos o
      INNER JOIN clientes c ON c.id = o.cliente_id AND c.empresa_id = o.empresa_id
      WHERE o.status = 'pendente'
        AND o.data_criacao <= CURRENT_DATE - INTERVAL '3 days'
        AND NOT EXISTS (
          SELECT 1
          FROM vendas v
          WHERE v.empresa_id = o.empresa_id
            AND v.orcamento_id = o.id
        )
    `,
  );

  let total = 0;

  for (const orcamento of rows) {
    const criadas = await criarNotificacoesParaUsuarios({
      empresaId: orcamento.empresa_id,
      tipo: 'sistema',
      titulo: 'Orçamento sem resposta',
      mensagem: `O orçamento de ${orcamento.cliente_nome}, no valor de ${formatarMoeda(orcamento.valor)}, está pendente há mais de 3 dias.`,
      referenciaId: orcamento.id,
      referenciaTipo: 'orcamento',
      prioridade: 'alta',
    }, client);

    total += criadas.length;
  }

  return total;
};

const gerarNotificacoesClienteInativo = async (client = pool) => {
  const { rows } = await client.query(
    `
      WITH ultima_interacao AS (
        SELECT
          c.id AS cliente_id,
          c.empresa_id,
          c.nome AS cliente_nome,
          GREATEST(
            c.criado_em,
            COALESCE((SELECT MAX(v.criado_em) FROM visitas v WHERE v.empresa_id = c.empresa_id AND v.cliente_id = c.id), c.criado_em),
            COALESCE((SELECT MAX(o.atualizado_em) FROM orcamentos o WHERE o.empresa_id = c.empresa_id AND o.cliente_id = c.id), c.criado_em),
            COALESCE((SELECT MAX(vd.criado_em) FROM vendas vd WHERE vd.empresa_id = c.empresa_id AND vd.cliente_id = c.id), c.criado_em),
            COALESCE((SELECT MAX(f.data_criacao) FROM follow_ups f WHERE f.empresa_id = c.empresa_id AND f.cliente_id = c.id), c.criado_em),
            COALESCE((SELECT MAX(f2.concluido_em) FROM follow_ups f2 WHERE f2.empresa_id = c.empresa_id AND f2.cliente_id = c.id), c.criado_em)
          ) AS ultima_interacao
        FROM clientes c
      )
      SELECT cliente_id, empresa_id, cliente_nome, ultima_interacao
      FROM ultima_interacao
      WHERE ultima_interacao < CURRENT_TIMESTAMP - INTERVAL '10 days'
    `,
  );

  let total = 0;

  for (const cliente of rows) {
    const criadas = await criarNotificacoesParaUsuarios({
      empresaId: cliente.empresa_id,
      tipo: 'sistema',
      titulo: 'Cliente inativo',
      mensagem: `${cliente.cliente_nome} está sem interação há mais de 10 dias. Vale sugerir um novo contato.`,
      referenciaId: cliente.cliente_id,
      referenciaTipo: 'cliente',
      prioridade: 'media',
    }, client);

    total += criadas.length;
  }

  return total;
};

const processarNotificacoesAutomaticas = async () => {
  const [followupsAtrasados, visitasDoDia, visitasAtrasadas, orcamentosSemResposta, clientesInativos] = await Promise.all([
    gerarNotificacoesFollowupAtrasado(),
    gerarNotificacoesVisitaDoDia(),
    gerarNotificacoesVisitaAtrasada(),
    gerarNotificacoesOrcamentoSemResposta(),
    gerarNotificacoesClienteInativo(),
  ]);

  return {
    followupsAtrasados,
    visitasDoDia,
    visitasAtrasadas,
    orcamentosSemResposta,
    clientesInativos,
    total: followupsAtrasados + visitasDoDia + visitasAtrasadas + orcamentosSemResposta + clientesInativos,
  };
};

const iniciarAutomacaoNotificacoes = () => {
  if (automationStarted) {
    return;
  }

  automationStarted = true;
  const intervaloMinutos = Number(process.env.NOTIFICATION_CRON_MINUTES || process.env.FOLLOWUP_CRON_MINUTES || 5);
  const intervaloMs = Math.max(intervaloMinutos, 1) * 60 * 1000;

  setInterval(async () => {
    try {
      const resultado = await processarNotificacoesAutomaticas();
      if (resultado.total > 0) {
        console.log(`[notificacoes] total=${resultado.total} followups=${resultado.followupsAtrasados} visitas_hoje=${resultado.visitasDoDia} visitas_atrasadas=${resultado.visitasAtrasadas} orcamentos=${resultado.orcamentosSemResposta} clientes_inativos=${resultado.clientesInativos}`);
      }
    } catch (error) {
      console.error('[notificacoes] erro ao executar automação:', error.message);
    }
  }, intervaloMs);

  processarNotificacoesAutomaticas().catch((error) => {
    console.error('[notificacoes] erro na execução inicial:', error.message);
  });
};

module.exports = {
  buscarUsuariosDaEmpresa,
  gerarNotificacoesClienteInativo,
  gerarNotificacoesFollowupAtrasado,
  gerarNotificacoesOrcamentoSemResposta,
  gerarNotificacoesVisitaAtrasada,
  gerarNotificacoesVisitaDoDia,
  iniciarAutomacaoNotificacoes,
  processarNotificacoesAutomaticas,
};
