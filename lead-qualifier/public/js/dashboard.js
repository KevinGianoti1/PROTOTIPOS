// Dashboard JavaScript
let leadsChart = null;
let originChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadOrigins();
    loadSources();
    updateDashboard();
    // Refresh dashboard every 30 seconds
    setTimeout(() => setInterval(updateDashboard, 30000), 0);
});

async function loadOrigins() {
    try {
        const res = await fetch('/api/dashboard/origins');
        const data = await res.json();
        const select = document.getElementById('originSelect');
        // Keep the default "Todas" option
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
        // Keep the default "Todas" option
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

async function updateDashboard() {
    try {
        await Promise.all([
            updateStats(),
            updateCharts(),
            updateRecentLeads()
        ]);
    } catch (error) {
        console.error('Erro ao atualizar dashboard:', error);
    }
}

async function updateStats() {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();
    document.getElementById('kpi-total').textContent = data.total;
    document.getElementById('kpi-qualified').textContent = data.qualified;
    document.getElementById('kpi-disqualified').textContent = data.disqualified;
    document.getElementById('kpi-conversion').textContent = `${data.conversionRate}%`;
    if (data.byOrigin) {
        updateOriginChart(data.byOrigin);
    }
}

async function updateCharts() {
    const res = await fetch('/api/dashboard/chart');
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
                backgroundColor: '#FF6B00',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#9CA3AF' } },
                x: { grid: { display: false }, ticks: { color: '#9CA3AF' } }
            }
        }
    });
}

function updateOriginChart(data) {
    const ctx = document.getElementById('originChart').getContext('2d');
    if (originChart) originChart.destroy();
    originChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: ['#FF6B00', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#9CA3AF' } } }
        }
    });
}

async function updateRecentLeads() {
    const res = await fetch('/api/dashboard/recent');
    const leads = await res.json();
    renderTable(leads);
}

async function applyFilters() {
    const origin = document.getElementById('originSelect').value;
    const source = document.getElementById('sourceSelect').value;
    const campaign = document.getElementById('campaignInput').value;
    const stage = document.getElementById('stageSelect').value;
    const params = new URLSearchParams();
    if (origin) params.append('origin', origin);
    if (source) params.append('source', source);
    if (campaign) params.append('campaign', campaign);
    if (stage) params.append('stage', stage);
    const res = await fetch(`/api/dashboard/filter?${params.toString()}`);
    const leads = await res.json();
    renderTable(leads);
}

function renderTable(leads) {
    const tbody = document.getElementById('leads-table-body');
    tbody.innerHTML = leads.map(lead => `
        <tr>
            <td>${new Date(lead.created_at).toLocaleDateString('pt-BR')} ${new Date(lead.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
            <td><div class="font-medium">${lead.name || 'Desconhecido'}</div></td>
            <td>${lead.phone}</td>
            <td>${lead.origin || '-'}</td>
            <td>${lead.source || '-'}</td>
            <td>${lead.campaign || '-'}</td>
            <td><span class="badge badge-${lead.stage}">${formatStage(lead.stage)}</span></td>
        </tr>
    `).join('');
}

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
}

function formatStage(stage) {
    const map = {
        'initial': 'Em Aberto',
        'collecting': 'Coletando',
        'completed': 'Qualificado',
        'disqualified': 'Desqualificado'
    };
    return map[stage] || stage;
}
