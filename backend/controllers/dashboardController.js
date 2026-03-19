const pool = require('../config/db');
const { obterIndicadoresFollowup } = require('../services/followupService');

const PERIODOS = {
  hoje: {
    label: 'Hoje',
    startExpr: 'CURRENT_DATE',
    endExpr: "CURRENT_DATE + INTERVAL '1 day'",
  },
  '7_dias': {
    label: 'Últimos 7 dias',
    startExpr: "CURRENT_DATE - INTERVAL '6 days'",
    endExpr: "CURRENT_DATE + INTERVAL '1 day'",
  },
  '30_dias': {
    label: 'Últimos 30 dias',
    startExpr: "CURRENT_DATE - INTERVAL '29 days'",
    endExpr: "CURRENT_DATE + INTERVAL '1 day'",
  },
  mes_atual: {
    label: 'Mês atual',
    startExpr: "DATE_TRUNC('month', CURRENT_DATE)",
    endExpr: "DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'",
  },
};

const parseNumero = (valor) => Number(valor || 0);
const percentual = (parte, total) => {
  if (!total) return 0;
  return Number(((parte / total) * 100).toFixed(2));
};

const obterConfiguracaoPeriodo = (periodo) => PERIODOS[periodo] || PERIODOS.mes_atual;

const obterDashboard = async (req, res) => {
  const periodoSelecionado = String(req.query.periodo || 'mes_atual');
  const periodo = obterConfiguracaoPeriodo(periodoSelecionado);
  const empresaId = req.user.empresa_id;

  try {
    const indicadoresFollowupPromise = obterIndicadoresFollowup({ empresaId, responsavelId: req.user.id, limite: 5 });

    const [
      clientesResult,
      visitasMesResult,
      orcamentosMesResult,
      vendasMesResult,
      faturamentoResult,
      graficoVendasResult,
      vendasPorStatusResult,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::INT AS total FROM clientes WHERE empresa_id = $1', [empresaId]),
      pool.query(
        `
          SELECT COUNT(*)::INT AS total
          FROM visitas
          WHERE empresa_id = $1
            AND data_visita >= ${periodo.startExpr}
            AND data_visita < ${periodo.endExpr}
        `,
        [empresaId],
      ),
      pool.query(
        `
          SELECT COUNT(*)::INT AS total
          FROM orcamentos
          WHERE empresa_id = $1
            AND data_criacao >= ${periodo.startExpr}
            AND data_criacao < ${periodo.endExpr}
        `,
        [empresaId],
      ),
      pool.query(
        `
          SELECT COUNT(*)::INT AS total
          FROM vendas
          WHERE empresa_id = $1
            AND data_venda >= ${periodo.startExpr}
            AND data_venda < ${periodo.endExpr}
        `,
        [empresaId],
      ),
      pool.query(
        `
          SELECT COALESCE(SUM(valor), 0)::NUMERIC(12, 2) AS total
          FROM vendas
          WHERE empresa_id = $1
            AND data_venda >= ${periodo.startExpr}
            AND data_venda < ${periodo.endExpr}
        `,
        [empresaId],
      ),
      pool.query(
        `
          WITH meses AS (
            SELECT GENERATE_SERIES(
              DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
              DATE_TRUNC('month', CURRENT_DATE),
              INTERVAL '1 month'
            ) AS mes
          )
          SELECT TO_CHAR(meses.mes, 'MM/YYYY') AS mes,
                 COALESCE(COUNT(v.id), 0)::INT AS vendas,
                 COALESCE(SUM(v.valor), 0)::NUMERIC(12, 2) AS faturamento
          FROM meses
          LEFT JOIN vendas v
            ON v.empresa_id = $1
           AND DATE_TRUNC('month', v.data_venda) = meses.mes
          GROUP BY meses.mes
          ORDER BY meses.mes
        `,
        [empresaId],
      ),
      pool.query(
        `
          SELECT status, COUNT(*)::INT AS total
          FROM vendas
          WHERE empresa_id = $1
            AND data_venda >= ${periodo.startExpr}
            AND data_venda < ${periodo.endExpr}
          GROUP BY status
          ORDER BY status
        `,
        [empresaId],
      ),
    ]);

    const clientes = parseNumero(clientesResult.rows[0]?.total);
    const visitas_mes = parseNumero(visitasMesResult.rows[0]?.total);
    const orcamentos_mes = parseNumero(orcamentosMesResult.rows[0]?.total);
    const vendas_mes = parseNumero(vendasMesResult.rows[0]?.total);
    const faturamento = parseNumero(faturamentoResult.rows[0]?.total);
    const ticket_medio = vendas_mes ? Number((faturamento / vendas_mes).toFixed(2)) : 0;
    const conversao_visita_orcamento = percentual(orcamentos_mes, visitas_mes);
    const conversao_orcamento_venda = percentual(vendas_mes, orcamentos_mes);
    const indicadoresFollowup = await indicadoresFollowupPromise;

    return res.status(200).json({
      sucesso: true,
      periodo: {
        chave: PERIODOS[periodoSelecionado] ? periodoSelecionado : 'mes_atual',
        label: periodo.label,
      },
      clientes,
      visitas_mes,
      orcamentos_mes,
      vendas_mes,
      faturamento,
      ticket_medio,
      conversao_visita_orcamento,
      conversao_orcamento_venda,
      grafico_vendas: graficoVendasResult.rows.map((item) => ({
        mes: item.mes,
        vendas: parseNumero(item.vendas),
        faturamento: parseNumero(item.faturamento),
      })),
      funil: [
        { etapa: 'Visitas', total: visitas_mes },
        { etapa: 'Orçamentos', total: orcamentos_mes },
        { etapa: 'Vendas', total: vendas_mes },
      ],
      vendas_por_status: vendasPorStatusResult.rows.map((item) => ({
        status: item.status,
        total: parseNumero(item.total),
      })),
      followups_pendentes: indicadoresFollowup.pendentes,
      followups_atrasados: indicadoresFollowup.atrasados,
      notificacoes_followups: indicadoresFollowup.notificacoes,
    });
  } catch (error) {
    return res.status(500).json({ sucesso: false, mensagem: error.message });
  }
};

module.exports = {
  obterDashboard,
};
