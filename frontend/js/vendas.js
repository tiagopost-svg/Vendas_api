const API_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('crm_token');

const empresaBadge = document.getElementById('empresaBadge');
const vendaForm = document.getElementById('vendaForm');
const vendaIdInput = document.getElementById('vendaId');
const clienteIdInput = document.getElementById('cliente_id');
const valorInput = document.getElementById('valor');
const statusInput = document.getElementById('status');
const formaPagamentoInput = document.getElementById('forma_pagamento');
const dataVendaInput = document.getElementById('data_venda');
const filtroStatusInput = document.getElementById('filtroStatus');
const vendasTabelaBody = document.getElementById('vendasTabelaBody');
const vendasMensagem = document.getElementById('vendasMensagem');
const totalVendasElemento = document.getElementById('totalVendas');
const quantidadeVendasElemento = document.getElementById('quantidadeVendas');
const cancelarEdicaoButton = document.getElementById('cancelarEdicao');
const recarregarVendasButton = document.getElementById('recarregarVendas');

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(valor || 0));

const redirecionarParaLogin = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_usuario');
  window.location.href = 'index.html';
};

const exibirMensagem = (mensagem, tipo = 'info') => {
  vendasMensagem.className = `alert alert-${tipo} mt-3`;
  vendasMensagem.textContent = mensagem;
  vendasMensagem.classList.remove('d-none');
};

const limparMensagem = () => {
  vendasMensagem.classList.add('d-none');
  vendasMensagem.textContent = '';
};

const resetarFormulario = () => {
  vendaForm.reset();
  vendaIdInput.value = '';
  cancelarEdicaoButton.classList.add('d-none');
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

const preencherFormulario = (venda) => {
  vendaIdInput.value = venda.id;
  clienteIdInput.value = venda.cliente_id;
  valorInput.value = venda.valor;
  statusInput.value = venda.status;
  formaPagamentoInput.value = venda.forma_pagamento;
  dataVendaInput.value = venda.data_venda;
  cancelarEdicaoButton.classList.remove('d-none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const renderizarVendas = (vendas) => {
  if (!vendas.length) {
    vendasTabelaBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">Nenhuma venda cadastrada.</td>
      </tr>
    `;
    return;
  }

  vendasTabelaBody.innerHTML = vendas
    .map(
      (venda) => `
        <tr>
          <td>${venda.id}</td>
          <td>
            <div class="fw-semibold">${venda.cliente_nome || `Cliente #${venda.cliente_id}`}</div>
            <div class="text-muted small">ID ${venda.cliente_id}</div>
          </td>
          <td><span class="badge text-bg-primary">${venda.status}</span></td>
          <td>${venda.forma_pagamento}</td>
          <td>${venda.data_venda}</td>
          <td>${formatarMoeda(venda.valor)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-2" data-action="editar" data-id="${venda.id}">Editar</button>
            <button class="btn btn-sm btn-outline-danger" data-action="excluir" data-id="${venda.id}">Excluir</button>
          </td>
        </tr>
      `,
    )
    .join('');
};

const carregarPerfil = async () => {
  const data = await request('/auth/me', { method: 'GET' });
  empresaBadge.textContent = `${data.usuario.empresa_nome} • ${data.usuario.nivel}`;
};

const carregarTotal = async () => {
  const data = await request('/vendas/total', { method: 'GET' });
  totalVendasElemento.textContent = formatarMoeda(data.dados.total_vendas);
  quantidadeVendasElemento.textContent = data.dados.quantidade_vendas;
};

const carregarVendas = async () => {
  try {
    const status = filtroStatusInput.value;
    const endpoint = status ? `/vendas?status=${encodeURIComponent(status)}` : '/vendas';
    const data = await request(endpoint, { method: 'GET' });
    renderizarVendas(data.dados);
  } catch (error) {
    renderizarVendas([]);
    exibirMensagem(error.message, 'danger');
  }
};

vendaForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  limparMensagem();

  const payload = {
    cliente_id: Number(clienteIdInput.value),
    valor: Number(valorInput.value),
    status: statusInput.value,
    forma_pagamento: formaPagamentoInput.value,
    data_venda: dataVendaInput.value,
  };

  try {
    const vendaId = vendaIdInput.value;
    const endpoint = vendaId ? `/vendas/${vendaId}` : '/vendas';
    const method = vendaId ? 'PUT' : 'POST';

    await request(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    exibirMensagem(vendaId ? 'Venda atualizada com sucesso.' : 'Venda criada com sucesso.', 'success');
    resetarFormulario();
    await Promise.all([carregarVendas(), carregarTotal()]);
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
});

cancelarEdicaoButton.addEventListener('click', () => {
  resetarFormulario();
  limparMensagem();
});

recarregarVendasButton.addEventListener('click', async () => {
  await Promise.all([carregarVendas(), carregarTotal()]);
});

filtroStatusInput.addEventListener('change', carregarVendas);

vendasTabelaBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  try {
    if (action === 'editar') {
      const data = await request(`/vendas/${id}`, { method: 'GET' });
      preencherFormulario(data.dados);
      return;
    }

    if (action === 'excluir') {
      const confirmar = window.confirm('Deseja realmente excluir esta venda?');

      if (!confirmar) {
        return;
      }

      await request(`/vendas/${id}`, { method: 'DELETE' });
      exibirMensagem('Venda excluída com sucesso.', 'success');
      await Promise.all([carregarVendas(), carregarTotal()]);
    }
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
});

const iniciarTela = async () => {
  if (!token) {
    redirecionarParaLogin();
    return;
  }

  try {
    await carregarPerfil();
    await Promise.all([carregarVendas(), carregarTotal()]);
  } catch (error) {
    exibirMensagem(error.message, 'danger');
  }
};

iniciarTela();
