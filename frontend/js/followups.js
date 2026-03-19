const API_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;
const token = localStorage.getItem('crm_token');

const empresaBadge = document.getElementById('empresaBadge');
const pendentesCount = document.getElementById('pendentesCount');
const atrasadosCount = document.getElementById('atrasadosCount');
const filtroStatus = document.getElementById('filtroStatus');
const somenteAtrasados = document.getElementById('somenteAtrasados');
const recarregarFollowups = document.getElementById('recarregarFollowups');
const followupsMensagem = document.getElementById('followupsMensagem');
const followupsLista = document.getElementById('followupsLista');

const redirecionarParaLogin = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_usuario');
  window.location.href = 'index.html';
};

const exibirMensagem = (mensagem, tipo = 'info') => {
  followupsMensagem.className = `alert alert-${tipo}`;
  followupsMensagem.textContent = mensagem;
  followupsMensagem.classList.remove('d-none');
};

const limparMensagem = () => {
  followupsMensagem.classList.add('d-none');
  followupsMensagem.textContent = '';
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
    throw new Error(data.mensagem || 'Falha na requisição.');
  }

  return data;
};

const sanitizarTelefone = (numero) => String(numero || '').replace(/\D/g, '');
const formatarDataHora = (valor) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));

const carregarPerfil = async () => {
  const data = await request('/auth/me');
  empresaBadge.textContent = `${data.usuario.empresa_nome} • ${data.usuario.nivel}`;
};

const carregarIndicadores = async () => {
  const data = await request('/dashboard');
  pendentesCount.textContent = data.followups_pendentes || 0;
  atrasadosCount.textContent = data.followups_atrasados || 0;
};

const montarLinkWhatsapp = (followup) => {
  const telefone = sanitizarTelefone(followup.cliente_telefone);
  if (!telefone) {
    return '#';
  }

  return `https://wa.me/${telefone}?text=${encodeURIComponent(followup.mensagem)}`;
};

const renderizarFollowups = (followups) => {
  if (!followups.length) {
    followupsLista.innerHTML = '<div class="col-12 text-center text-muted py-4">Nenhum follow-up encontrado.</div>';
    return;
  }

  followupsLista.innerHTML = followups.map((followup) => {
    const statusLabel = followup.atrasado ? 'Atrasado' : followup.status;
    const statusClass = followup.atrasado
      ? 'text-bg-danger'
      : followup.status === 'concluido'
        ? 'text-bg-success'
        : followup.status === 'cancelado'
          ? 'text-bg-secondary'
          : 'text-bg-warning';

    return `
      <div class="col-12">
        <div class="card border-0 shadow-sm followup-card ${followup.atrasado ? 'followup-overdue' : ''}">
          <div class="card-body d-flex flex-column gap-3">
            <div class="d-flex justify-content-between gap-3 flex-wrap">
              <div>
                <div class="fw-semibold">${followup.cliente_nome}</div>
                <div class="small text-muted">${followup.tipo} • ${formatarDataHora(followup.data_proxima_acao)}</div>
              </div>
              <span class="badge ${statusClass} align-self-start">${statusLabel}</span>
            </div>
            <div>${followup.mensagem}</div>
            <div class="d-grid gap-2 d-md-flex flex-wrap">
              <a
                class="btn btn-success btn-lg ${montarLinkWhatsapp(followup) === '#' ? 'disabled' : ''}"
                href="${montarLinkWhatsapp(followup)}"
                target="_blank"
                rel="noopener"
              >💬 WhatsApp</a>
              ${followup.status === 'pendente' ? `<button class="btn btn-outline-primary btn-lg" data-action="concluir" data-id="${followup.id}">✔ Concluir</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

const carregarFollowups = async () => {
  try {
    limparMensagem();
    const params = new URLSearchParams({ status: filtroStatus.value });
    if (somenteAtrasados.checked) {
      params.set('atrasados', 'true');
    }
    const data = await request(`/followups?${params.toString()}`);
    renderizarFollowups(data.dados);
  } catch (error) {
    renderizarFollowups([]);
    exibirMensagem(error.message, 'danger');
  }
};

followupsLista.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="concluir"]');
  if (!button) return;

  try {
    await request(`/followups/${button.dataset.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'concluido' }),
    });
    exibirMensagem('Follow-up concluído com sucesso.', 'success');
    await Promise.all([carregarIndicadores(), carregarFollowups()]);
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
});

filtroStatus.addEventListener('change', carregarFollowups);
somenteAtrasados.addEventListener('change', carregarFollowups);
recarregarFollowups.addEventListener('click', async () => {
  await Promise.all([carregarIndicadores(), carregarFollowups()]);
});

const iniciarTela = async () => {
  if (!token) {
    redirecionarParaLogin();
    return;
  }

  try {
    await carregarPerfil();
    await Promise.all([carregarIndicadores(), carregarFollowups()]);
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
};

iniciarTela();
