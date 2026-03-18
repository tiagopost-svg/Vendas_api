const { processarFollowupsPendentes } = require('./followupService');

let automationStarted = false;

const executarCicloFollowups = async () => {
  try {
    const resultado = await processarFollowupsPendentes();
    if (resultado.totalPendentesParaAcao > 0 || resultado.novosFollowupsGerados > 0) {
      console.log(
        `[followups] pendentes_para_acao=${resultado.totalPendentesParaAcao} novos_gerados=${resultado.novosFollowupsGerados}`,
      );
    }
  } catch (error) {
    console.error('[followups] erro ao executar automação:', error.message);
  }
};

const iniciarAutomacaoFollowups = () => {
  if (automationStarted) {
    return;
  }

  automationStarted = true;
  const intervaloMinutos = Number(process.env.FOLLOWUP_CRON_MINUTES || 5);
  const intervaloMs = Math.max(intervaloMinutos, 1) * 60 * 1000;

  setInterval(() => {
    executarCicloFollowups();
  }, intervaloMs);

  executarCicloFollowups();
};

module.exports = {
  iniciarAutomacaoFollowups,
};
