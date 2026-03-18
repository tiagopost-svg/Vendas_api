const API_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('crm_token');

const empresaBadge = document.getElementById('empresaBadge');
const naoLidasCount = document.getElementById('naoLidasCount');
const filtroLeitura = document.getElementById('filtroLeitura');
const filtroTipo = document.getElementById('filtroTipo');
const recarregarNotificacoes = document.getElementById('recarregarNotificacoes');
const notificacoesMensagem = document.getElementById('notificacoesMensagem');
const notificacoesLista = document.getElementById('notificacoesLista');

const redirecionarParaLogin = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_usuario');
  window.location.href = 'index.html';
};

const exibirMensagem = (mensagem, tipo = 'info') => {
  notificacoesMensagem.className = `alert alert-${tipo}`;
  notificacoesMensagem.textContent = mensagem;
  notificacoesMensagem.classList.remove('d-none');
};

const limparMensagem = () => {
  notificacoesMensagem.classList.add('d-none');
  notificacoesMensagem.textContent = '';
};

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    redirecionarParaLogin();
    throw new Error('Sessão expirada.');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.mensagem || 'Falha ao carregar notificações.');
  }

  return data;
};

const formatarDataHora = (valor) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));

const formatarTempoRelativo = (valor) => {
  const agora = Date.now();
  const data = new Date(valor).getTime();
  const diffMs = data - agora;
  const diffAbsMin = Math.round(Math.abs(diffMs) / 60000);
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

  if (diffAbsMin < 60) return rtf.format(Math.round(diffMs / 60000), 'minute');
  if (diffAbsMin < 60 * 24) return rtf.format(Math.round(diffMs / 3600000), 'hour');
  return rtf.format(Math.round(diffMs / 86400000), 'day');
};

const obterDestinoNotificacao = (notificacao) => {
  if (!notificacao.destino_id) {
    return 'notificacoes.html';
  }

  if (notificacao.destino_tipo === 'cliente') {
    return `cliente_detalhe.html?id=${notificacao.destino_id}`;
  }

  if (notificacao.destino_tipo === 'visita') {
    return `visitas.html?visita_id=${notificacao.destino_id}`;
  }

  if (notificacao.destino_tipo === 'orcamento') {
    return `orcamentos.html?orcamento_id=${notificacao.destino_id}`;
  }

  return 'dashboard.html';
};

const classePrioridade = (prioridade) => {
  if (prioridade === 'alta') return 'notification-priority-high';
  if (prioridade === 'media') return 'notification-priority-medium';
  return 'notification-priority-low';
};

const renderizarNotificacoes = (notificacoes) => {
  const tipoSelecionado = filtroTipo.value;
  const listaFiltrada = tipoSelecionado
    ? notificacoes.filter((notificacao) => notificacao.tipo === tipoSelecionado)
    : notificacoes;

  if (!listaFiltrada.length) {
    notificacoesLista.innerHTML = '<div class="text-center text-muted py-4">Nenhuma notificação encontrada.</div>';
    return;
  }

  notificacoesLista.innerHTML = listaFiltrada.map((notificacao) => `
    <article class="card border-0 shadow-sm notification-card ${classePrioridade(notificacao.prioridade)} ${notificacao.lida ? '' : 'notification-unread'}">
      <div class="card-body d-flex flex-column gap-3">
        <div class="d-flex justify-content-between gap-3 flex-wrap">
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
              <h2 class="h6 mb-0">${notificacao.titulo}</h2>
              <span class="badge text-bg-light text-uppercase">${notificacao.tipo}</span>
              <span class="badge ${notificacao.prioridade === 'alta' ? 'text-bg-danger' : notificacao.prioridade === 'media' ? 'text-bg-warning' : 'text-bg-secondary'} text-uppercase">${notificacao.prioridade}</span>
              ${notificacao.lida ? '<span class="badge text-bg-success">Lida</span>' : '<span class="badge text-bg-primary">Nova</span>'}
            </div>
            <div class="text-muted small">${formatarDataHora(notificacao.data_criacao)} • ${formatarTempoRelativo(notificacao.data_criacao)}</div>
          </div>
          <div class="small text-muted text-end">${notificacao.cliente_nome || ''}</div>
        </div>
        <p class="mb-0">${notificacao.mensagem}</p>
        <div class="d-grid gap-2 d-md-flex flex-wrap">
          <a class="btn btn-outline-primary" href="${obterDestinoNotificacao(notificacao)}">Abrir contexto</a>
          ${notificacao.lida ? '' : `<button type="button" class="btn btn-primary" data-action="lida" data-id="${notificacao.id}">Marcar como lida</button>`}
        </div>
      </div>
    </article>
  `).join('');
};

const carregarPerfil = async () => {
  const data = await request('/auth/me');
  empresaBadge.textContent = `${data.usuario.empresa_nome} • ${data.usuario.nivel}`;
};

const carregarNotificacoes = async () => {
  try {
    limparMensagem();
    const params = new URLSearchParams({ limit: '100' });
    if (filtroLeitura.value === 'nao_lidas') {
      params.set('nao_lidas', 'true');
    }

    const data = await request(`/notificacoes?${params.toString()}`);
    naoLidasCount.textContent = data.resumo?.nao_lidas || 0;
    renderizarNotificacoes(data.dados);
    window.CRMNavbar?.atualizarContador();
  } catch (error) {
    renderizarNotificacoes([]);
    exibirMensagem(error.message, 'danger');
  }
};

notificacoesLista.addEventListener('click', async (event) => {
  const botao = event.target.closest('button[data-action="lida"]');
  if (!botao) return;

  try {
    await request(`/notificacoes/${botao.dataset.id}/lida`, { method: 'PUT' });
    exibirMensagem('Notificação marcada como lida.', 'success');
    await carregarNotificacoes();
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
});

filtroLeitura.addEventListener('change', carregarNotificacoes);
filtroTipo.addEventListener('change', carregarNotificacoes);
recarregarNotificacoes.addEventListener('click', carregarNotificacoes);

const iniciarTela = async () => {
  if (!token) {
    redirecionarParaLogin();
    return;
  }

  try {
    await carregarPerfil();
    await carregarNotificacoes();
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
};

iniciarTela();
