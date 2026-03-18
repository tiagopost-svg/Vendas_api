const API_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('crm_token');

const empresaBadge = document.getElementById('empresaBadge');
const periodoFiltro = document.getElementById('periodoFiltro');
const periodoLabel = document.getElementById('periodoLabel');
const dashboardMensagem = document.getElementById('dashboardMensagem');
const followupNotificacoes = document.getElementById('followupNotificacoes');

const cards = {
  clientes: document.querySelector('[data-card="clientes"]'),
  visitas: document.querySelector('[data-card="visitas"]'),
  orcamentos: document.querySelector('[data-card="orcamentos"]'),
  vendas: document.querySelector('[data-card="vendas"]'),
  faturamento: document.querySelector('[data-card="faturamento"]'),
  ticket: document.querySelector('[data-card="ticket"]'),
  convVisitaOrcamento: document.querySelector('[data-card="conv-visita-orcamento"]'),
  convOrcamentoVenda: document.querySelector('[data-card="conv-orcamento-venda"]'),
  followupsPendentes: document.querySelector('[data-card="followups-pendentes"]'),
  followupsAtrasados: document.querySelector('[data-card="followups-atrasados"]'),
};

const graficoVendasCanvas = document.getElementById('graficoVendas');
const graficoStatusCanvas = document.getElementById('graficoStatus');
const graficoFunilCanvas = document.getElementById('graficoFunil');

let graficoVendas;
let graficoStatus;
let graficoFunil;

const redirecionarParaLogin = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_usuario');
  window.location.href = 'index.html';
};

const exibirMensagem = (mensagem, tipo = 'info') => {
  dashboardMensagem.className = `alert alert-${tipo}`;
  dashboardMensagem.textContent = mensagem;
  dashboardMensagem.classList.remove('d-none');
};

const limparMensagem = () => {
  dashboardMensagem.classList.add('d-none');
  dashboardMensagem.textContent = '';
};

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(valor || 0));

const formatarPercentual = (valor) => `${Number(valor || 0).toFixed(2)}%`;
const sanitizarTelefone = (numero) => String(numero || '').replace(/\D/g, '');
const formatarDataHora = (valor) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));

const request = async (endpoint) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    redirecionarParaLogin();
    throw new Error('Sessão expirada.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.mensagem || 'Falha ao carregar dashboard.');
  }

  return data;
};

const destruirGraficos = () => {
  [graficoVendas, graficoStatus, graficoFunil].forEach((grafico) => {
    if (grafico) {
      grafico.destroy();
    }
  });
};

const renderizarCards = (data) => {
  cards.clientes.textContent = data.clientes;
  cards.visitas.textContent = data.visitas_mes;
  cards.orcamentos.textContent = data.orcamentos_mes;
  cards.vendas.textContent = data.vendas_mes;
  cards.faturamento.textContent = formatarMoeda(data.faturamento);
  cards.ticket.textContent = formatarMoeda(data.ticket_medio);
  cards.convVisitaOrcamento.textContent = formatarPercentual(data.conversao_visita_orcamento);
  cards.convOrcamentoVenda.textContent = formatarPercentual(data.conversao_orcamento_venda);
  cards.followupsPendentes.textContent = data.followups_pendentes || 0;
  cards.followupsAtrasados.textContent = data.followups_atrasados || 0;
  periodoLabel.textContent = data.periodo.label;
};

const renderizarNotificacoesFollowup = (data) => {
  if (!data.notificacoes_followups?.length) {
    followupNotificacoes.innerHTML = '<div class="text-muted small">Nenhum follow-up pendente no momento.</div>';
    return;
  }

  followupNotificacoes.innerHTML = data.notificacoes_followups.map((item) => {
    const telefone = sanitizarTelefone(item.cliente_telefone);
    const whatsappLink = telefone ? `https://wa.me/${telefone}?text=${encodeURIComponent(item.mensagem)}` : '#';

    return `
      <div class="list-group-item px-0 followup-list-item ${item.atrasado ? 'followup-overdue' : ''}">
        <div class="d-flex justify-content-between gap-3 flex-wrap">
          <div>
            <div class="fw-semibold">${item.cliente_nome}</div>
            <div class="small text-muted">${item.tipo} • ${formatarDataHora(item.data_proxima_acao)}</div>
            <div class="small">${item.mensagem}</div>
          </div>
          <div class="d-flex gap-2 flex-wrap align-self-start">
            <span class="badge ${item.atrasado ? 'text-bg-danger' : 'text-bg-warning'}">${item.atrasado ? 'Atrasado' : 'Pendente'}</span>
            <a class="btn btn-success btn-sm ${whatsappLink === '#' ? 'disabled' : ''}" href="${whatsappLink}" target="_blank" rel="noopener">💬 WhatsApp</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

const criarGraficoVendas = (data) => {
  graficoVendas = new Chart(graficoVendasCanvas, {
    type: 'bar',
    data: {
      labels: data.grafico_vendas.map((item) => item.mes),
      datasets: [
        {
          type: 'bar',
          label: 'Qtd. vendas',
          data: data.grafico_vendas.map((item) => item.vendas),
          backgroundColor: 'rgba(13, 110, 253, 0.75)',
          borderRadius: 8,
        },
        {
          type: 'line',
          label: 'Faturamento (R$)',
          data: data.grafico_vendas.map((item) => item.faturamento),
          borderColor: '#20c997',
          backgroundColor: 'rgba(32, 201, 151, 0.18)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
        y1: {
          beginAtZero: true,
          position: 'right',
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
};

const criarGraficoStatus = (data) => {
  const status = data.vendas_por_status.length
    ? data.vendas_por_status
    : [
        { status: 'sem_vendas', total: 1 },
      ];

  graficoStatus = new Chart(graficoStatusCanvas, {
    type: 'doughnut',
    data: {
      labels: status.map((item) => item.status.replaceAll('_', ' ')),
      datasets: [
        {
          data: status.map((item) => item.total),
          backgroundColor: ['#0d6efd', '#20c997', '#ffc107', '#dc3545'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
      },
      cutout: '65%',
    },
  });
};

const criarGraficoFunil = (data) => {
  graficoFunil = new Chart(graficoFunilCanvas, {
    type: 'bar',
    data: {
      labels: data.funil.map((item) => item.etapa),
      datasets: [
        {
          label: 'Quantidade',
          data: data.funil.map((item) => item.total),
          backgroundColor: ['#0d6efd', '#6f42c1', '#198754'],
          borderRadius: 10,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });
};

const carregarPerfil = async () => {
  const data = await request('/auth/me');
  empresaBadge.textContent = `${data.usuario.empresa_nome} • ${data.usuario.nivel}`;
};

const carregarDashboard = async () => {
  try {
    limparMensagem();
    destruirGraficos();
    const data = await request(`/dashboard?periodo=${encodeURIComponent(periodoFiltro.value)}`);
    renderizarCards(data);
    renderizarNotificacoesFollowup(data);
    criarGraficoVendas(data);
    criarGraficoStatus(data);
    criarGraficoFunil(data);
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
};

const iniciarDashboard = async () => {
  if (!token) {
    redirecionarParaLogin();
    return;
  }

  try {
    await carregarPerfil();
    await carregarDashboard();
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
};

periodoFiltro.addEventListener('change', carregarDashboard);

iniciarDashboard();
