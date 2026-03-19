const API_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;
const token = localStorage.getItem('crm_token');
const clienteId = new URLSearchParams(window.location.search).get('id');

const empresaBadge = document.getElementById('empresaBadge');
const clienteMensagem = document.getElementById('clienteMensagem');
const clienteNome = document.getElementById('clienteNome');
const clienteResumo = document.getElementById('clienteResumo');
const clienteInfoGrid = document.getElementById('clienteInfoGrid');
const timelineLista = document.getElementById('timelineLista');
const recarregarTimeline = document.getElementById('recarregarTimeline');

const icones = {
  cliente: '👤',
  visita: '📍',
  orcamento: '📄',
  venda: '💰',
  followup: '🔔',
};

const redirecionarParaLogin = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_usuario');
  window.location.href = 'index.html';
};

const exibirMensagem = (mensagem, tipo = 'info') => {
  clienteMensagem.className = `alert alert-${tipo}`;
  clienteMensagem.textContent = mensagem;
  clienteMensagem.classList.remove('d-none');
};

const limparMensagem = () => {
  clienteMensagem.classList.add('d-none');
  clienteMensagem.textContent = '';
};

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
    throw new Error(data.mensagem || 'Falha ao carregar dados do cliente.');
  }

  return data;
};

const formatarData = (valor) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));
const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));

const renderizarPerfil = (cliente) => {
  clienteNome.textContent = cliente.nome;
  clienteResumo.textContent = `${cliente.status_pipeline} • ${cliente.tipo} • ${cliente.cidade || 'Cidade não informada'}`;

  const campos = [
    ['Telefone', cliente.telefone || 'Não informado'],
    ['E-mail', cliente.email || 'Não informado'],
    ['Cidade', cliente.cidade || 'Não informada'],
    ['Endereço', cliente.endereco || 'Não informado'],
    ['Pipeline', cliente.status_pipeline],
    ['Origem', cliente.origem_lead || 'Não informada'],
  ];

  clienteInfoGrid.innerHTML = campos.map(([label, valor]) => `
    <div class="col-md-6 col-xl-4">
      <div class="border rounded-4 p-3 bg-light-subtle h-100">
        <div class="small text-muted mb-1">${label}</div>
        <div class="fw-semibold">${valor}</div>
      </div>
    </div>
  `).join('');
};

const montarDetalhes = (evento) => {
  const extra = evento.extra || {};
  const detalhes = [];

  if (extra.observacoes) detalhes.push(`<div><strong>Observações:</strong> ${extra.observacoes}</div>`);
  if (extra.resultado) detalhes.push(`<div><strong>Resultado:</strong> ${extra.resultado}</div>`);
  if (extra.tipo_visita) detalhes.push(`<div><strong>Tipo da visita:</strong> ${extra.tipo_visita}</div>`);
  if (extra.valor !== undefined) detalhes.push(`<div><strong>Valor:</strong> ${formatarMoeda(extra.valor)}</div>`);
  if (extra.status) detalhes.push(`<div><strong>Status:</strong> ${extra.status}</div>`);
  if (extra.forma_pagamento) detalhes.push(`<div><strong>Pagamento:</strong> ${extra.forma_pagamento}</div>`);
  if (extra.data_validade) detalhes.push(`<div><strong>Validade:</strong> ${formatarData(extra.data_validade)}</div>`);
  if (extra.data_proxima_acao) detalhes.push(`<div><strong>Próxima ação:</strong> ${formatarData(extra.data_proxima_acao)}</div>`);
  if (extra.mensagem) detalhes.push(`<div><strong>Mensagem:</strong> ${extra.mensagem}</div>`);
  if (extra.imagem_url) detalhes.push(`<div><a href="${extra.imagem_url}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-sm mt-2">Ver imagem da visita</a></div>`);
  if (extra.imagem_local_url) detalhes.push(`<div><a href="${extra.imagem_local_url}" target="_blank" rel="noopener" class="btn btn-outline-secondary btn-sm mt-2">Ver imagem local</a></div>`);

  return detalhes.length ? detalhes.join('') : '<div class="text-muted">Sem detalhes adicionais.</div>';
};

const renderizarTimeline = (timeline) => {
  if (!timeline.length) {
    timelineLista.innerHTML = '<div class="text-center text-muted py-4">Este cliente ainda não possui histórico.</div>';
    return;
  }

  timelineLista.innerHTML = timeline.map((evento, index) => `
    <div class="timeline-item ${evento.destaque ? 'timeline-item-destaque' : ''}">
      <button class="timeline-trigger w-100 text-start bg-transparent border-0 p-0" data-toggle-detail="detail-${index}">
        <div class="timeline-marker">${icones[evento.tipo] || '•'}</div>
        <div class="timeline-content card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
              <div>
                <div class="small text-muted">${formatarData(evento.data)}</div>
                <div class="fw-semibold">${evento.descricao}</div>
              </div>
              <span class="badge ${evento.tipo === 'venda' ? 'text-bg-success' : 'text-bg-light'}">${evento.tipo}</span>
            </div>
            <div class="small text-muted mt-2">Clique para expandir detalhes.</div>
            <div class="timeline-detail d-none mt-3" id="detail-${index}">${montarDetalhes(evento)}</div>
          </div>
        </div>
      </button>
    </div>
  `).join('');
};

const carregarPerfilETimeline = async () => {
  if (!clienteId) {
    exibirMensagem('Cliente não informado.', 'warning');
    return;
  }

  try {
    limparMensagem();
    const [perfil, timeline, perfilUsuario] = await Promise.all([
      request(`/clientes/${clienteId}`),
      request(`/clientes/${clienteId}/timeline?limit=50`),
      request('/auth/me'),
    ]);
    empresaBadge.textContent = `${perfilUsuario.usuario.empresa_nome} • ${perfilUsuario.usuario.nivel}`;
    renderizarPerfil(perfil.dados);
    renderizarTimeline(timeline.dados.timeline);
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
};

timelineLista.addEventListener('click', (event) => {
  const botao = event.target.closest('[data-toggle-detail]');
  if (!botao) return;

  const detail = document.getElementById(botao.dataset.toggleDetail);
  if (!detail) return;
  detail.classList.toggle('d-none');
});

recarregarTimeline.addEventListener('click', carregarPerfilETimeline);

if (!token) {
  redirecionarParaLogin();
} else {
  carregarPerfilETimeline();
}
