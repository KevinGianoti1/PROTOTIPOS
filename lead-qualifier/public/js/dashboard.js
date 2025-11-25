// Dashboard JavaScript - Phase 1 Enhanced
let leadsChart = null;
let originChart = null;
let funnelChart = null;
let scoreChart = null;
let cnaeChart = null;
let productChart = null;
let geoChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadOrigins();
    loadSources();
    updateDashboard();
});

async function loadOrigins() {
    try {
        const res = await fetch('/api/dashboard/origins');
        const data = await res.json();
        const select = document.getElementById('originSelect');
        select.innerHTML = '<option value="">Todas</option>';
        data.origins.forEach(orig => {
            const opt = document.createElement('option');
            opt.value = orig;
            opt.textContent = orig;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Erro ao carregar origens:', e);
    }
}

async function loadSources() {
    try {
        const res = await fetch('/api/dashboard/sources');
        const data = await res.json();
        const select = document.getElementById('sourceSelect');
        select.innerHTML = '<option value="">Todas</option>';
        data.sources.forEach(src => {
            const opt = document.createElement('option');
            opt.value = src;
            opt.textContent = src;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('Erro ao carregar fontes:', e);
    }
}

async function updateDashboard(filters = {}) {
    try {
        await Promise.all([
            updateStats(filters),
            updateAdvancedStats(filters),
            updateCharts(filters),
            updateRecentLeads(filters)
        ]);
    } catch (error) {
        console.error('Erro ao atualizar dashboard:', error);
    }
}

// Original Stats
async function updateStats(filters = {}) {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/dashboard/stats?${params}`);
    const data = await res.json();
    document.getElementById('kpi-total').textContent = data.total;
    document.getElementById('kpi-qualified').textContent = data.qualified;
    document.getElementById('kpi-disqualified').textContent = data.disqualified;
    document.getElementById('kpi-conversion').textContent = `${data.conversionRate}%`;
    if (data.byOrigin) {
        updateOriginChart(data.byOrigin, filters);
    }
}

// Phase 1 - Advanced Stats
async function updateAdvancedStats(filters = {}) {
    try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`/api/dashboard/advanced-stats?${params}`);
        const data = await res.json();

        // Update KPIs
        document.getElementById('kpi-avg-time').textContent = `${data.avgQualificationTime}h`;
        document.getElementById('kpi-response-rate').textContent = `${data.responseRate}%`;
        document.getElementById('kpi-avg-ticket').textContent = `R$ ${data.avgTicket}`;
        document.getElementById('kpi-catalogs').textContent = data.catalogsSent;

        // Update temperature distribution
        const tempData = data.byTemperature;
        const quente = tempData.find(t => t.name === 'Quente')?.count || 0;
        const morno = tempData.find(t => t.name === 'Morno')?.count || 0;
        const frio = tempData.find(t => t.name === 'Frio')?.count || 0;

        document.getElementById('temp-hot').textContent = quente;
        document.getElementById('temp-warm').textContent = morno;
        document.getElementById('temp-cold').textContent = frio;
    } catch (e) {
        console.error('Erro ao carregar stats avançadas:', e);
    }
}

async function updateCharts(filters = {}) {
    // Original charts
    await updateLeadsChart(filters);

    // Phase 1 new charts
    await updateFunnelChart(filters);
    await updateScoreChart(filters);
    await updateCNAEChart(filters);
    await updateProductChart(filters);
    await updateGeoChart(filters);
}

async function updateLeadsChart(filters = {}) {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/dashboard/chart?${params}`);
    const data = await res.json();
    const ctx = document.getElementById('leadsChart').getContext('2d');
    if (leadsChart) leadsChart.destroy();
    leadsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => formatDate(d.date)),
            datasets: [{
                label: 'Leads',
                data: data.map(d => d.count),
                backgroundColor: '#FF9000',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#A8A8B3' } },
                x: { grid: { display: false }, ticks: { color: '#A8A8B3' } }
            }
        }
    });
}

function updateOriginChart(data, currentFilters = {}) {
    const ctx = document.getElementById('originChart').getContext('2d');
    if (originChart) originChart.destroy();
    originChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: ['#FF9000', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#A8A8B3' } } }
        }
    });
    // Click on a segment to filter by that origin
    originChart.canvas.onclick = function (evt) {
        const points = originChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
        if (points.length) {
            const index = points[0].index;
            const selectedOrigin = data.map(d => d.name)[index];
            document.getElementById('originSelect').value = selectedOrigin;
            applyFilters({ ...currentFilters, origin: selectedOrigin });
        }
    };
}

async function updateFunnelChart(filters = {}) {
    try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`/api/dashboard/funnel?${params}`);
        const data = await res.json();
        const ctx = document.getElementById('funnelChart').getContext('2d');
        if (funnelChart) funnelChart.destroy();
        funnelChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.stage),
                datasets: [{
                    label: 'Leads',
                    data: data.map(d => d.count),
                    backgroundColor: ['#60A5FA', '#FBA94C', '#04D361'],
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#A8A8B3' } },
                    y: { grid: { display: false }, ticks: { color: '#A8A8B3' } }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const stage = data[index].stage;
                        applyFilters({ ...filters, stage });
                    }
                }
            }
        });
    } catch (e) {
        console.error('Erro ao carregar funil:', e);
    }
}

async function updateScoreChart(filters = {}) {
    try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`/api/dashboard/lead-score-distribution?${params}`);
        const data = await res.json();
        const ctx = document.getElementById('scoreChart').getContext('2d');
        if (scoreChart) scoreChart.destroy();
        scoreChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.range),
                datasets: [{
                    label: 'Leads',
                    data: data.map(d => d.count),
                    backgroundColor: '#FF9000',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#A8A8B3' } },
                    x: { grid: { display: false }, ticks: { color: '#A8A8B3' } }
                }
            }
        });
    } catch (e) {
        console.error('Erro ao carregar distribuição de scores:', e);
    }
}

async function updateCNAEChart(filters = {}) {
    try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`/api/dashboard/top-cnaes?${params}`);
        const data = await res.json();
        const ctx = document.getElementById('cnaeChart').getContext('2d');
        if (cnaeChart) cnaeChart.destroy();
        cnaeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.name.substring(0, 30) + '...'),
                datasets: [{
                    label: 'Leads',
                    data: data.map(d => d.count),
                    backgroundColor: '#3B82F6',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#A8A8B3' } },
                    y: { grid: { display: false }, ticks: { color: '#A8A8B3' } }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const cnae = data[index].name;
                        applyFilters({ ...filters, cnae });
                    }
                }
            }
        });
    } catch (e) {
        console.error('Erro ao carregar top CNAEs:', e);
    }
}

async function updateProductChart(filters = {}) {
    try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`/api/dashboard/top-products?${params}`);
        const data = await res.json();
        const ctx = document.getElementById('productChart').getContext('2d');
        if (productChart) productChart.destroy();
        productChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.name),
                datasets: [{
                    label: 'Leads',
                    data: data.map(d => d.count),
                    backgroundColor: '#10B981',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#A8A8B3' } },
                    y: { grid: { display: false }, ticks: { color: '#A8A8B3' } }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const product = data[index].name;
                        applyFilters({ ...filters, product });
                    }
                }
            }
        });
    } catch (e) {
        console.error('Erro ao carregar top produtos:', e);
    }
}

async function updateGeoChart(filters = {}) {
    try {
        const params = new URLSearchParams(filters);
        const res = await fetch(`/api/dashboard/geographic?${params}`);
        const data = await res.json();
        const ctx = document.getElementById('geoChart').getContext('2d');
        if (geoChart) geoChart.destroy();
        geoChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => d.name),
                datasets: [{
                    label: 'Leads',
                    data: data.map(d => d.count),
                    backgroundColor: '#8B5CF6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#A8A8B3' } },
                    x: { grid: { display: false }, ticks: { color: '#A8A8B3' } }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const state = data[index].name;
                        applyFilters({ ...filters, state });
                    }
                }
            }
        });
    } catch (e) {
        console.error('Erro ao carregar distribuição geográfica:', e);
    }
}

async function updateRecentLeads(filters = {}) {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/dashboard/filter?${params}`);
    const leads = await res.json();
    renderTable(leads);
}

async function applyFilters(overrides = {}) {
    const origin = overrides.origin || document.getElementById('originSelect').value;
    // Determine linked source and campaign based on origin
    let source = '';
    let campaign = '';
    if (origin === 'Site') {
        source = 'Site';
        campaign = 'Google ADS';
    } else if (origin === 'Instagram') {
        source = 'Redes Sociais';
        campaign = 'Tráfego Pago';
    } else {
        source = overrides.source || document.getElementById('sourceSelect').value;
        campaign = overrides.campaign || document.getElementById('campaignSelect').value;
    }
    const stage = overrides.stage || document.getElementById('stageSelect').value;

    const filters = {
        origin,
        source,
        campaign,
        stage,
        ...overrides // Overrides take precedence (e.g. click on chart)
    };

    // Remove empty filters
    Object.keys(filters).forEach(key => filters[key] === undefined || filters[key] === '' ? delete filters[key] : {});

    // Update global dashboard with all filters
    await updateDashboard(filters);
}

function renderTable(leads) {
    const tbody = document.getElementById('leadsTableBody');
    if (!leads || leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Nenhum lead encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = leads.map(lead => `
        <tr>
            <td>${lead.name || lead.razao_social || 'Desconhecido'}</td>
            <td>${lead.phone}</td>
            <td>${lead.cidade && lead.estado ? `${lead.cidade}/${lead.estado}` : '-'}</td>
            <td>${lead.cnae_descricao ? lead.cnae_descricao.substring(0, 25) + '...' : '-'}</td>
            <td>${formatScore(lead.lead_score)}</td>
            <td>${formatTemperature(lead.temperatura)}</td>
            <td><span class="badge badge-${lead.stage}">${formatStage(lead.stage)}</span></td>
            <td>${formatDateTime(lead.created_at)}</td>
        </tr>
    `).join('');
}

function formatScore(score) {
    if (!score) return '-';
    let className = 'score-low';
    if (score >= 70) className = 'score-high';
    else if (score >= 40) className = 'score-medium';
    return `<span class="${className}">${score}</span>`;
}

function formatTemperature(temp) {
    if (!temp) return '-';
    const icons = {
        'Quente': '🔥',
        'Morno': '🟡',
        'Frio': '❄️'
    };
    return `<span class="badge-${temp.toLowerCase()}">${icons[temp] || ''} ${temp}</span>`;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
}

function formatStage(stage) {
    const map = {
        'initial': 'Em Andamento',
        'collecting': 'Coletando',
        'completed': 'Qualificado',
        'disqualified': 'Desqualificado'
    };
    return map[stage] || stage;
}
