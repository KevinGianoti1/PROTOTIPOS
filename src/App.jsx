import React, { useEffect, useState } from 'react';
import Layout from './components/Layout';
import StatsCard from './components/StatsCard';
import SalesChart from './components/SalesChart';
import RecentOrders from './components/RecentOrders';
import { fetchSheetData, parseCurrency } from './services/googleSheets';
import { salesData as mockSalesData, recentOrders as mockRecentOrders, stats as mockStats } from './data/mockData';

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    stats: mockStats,
    salesData: mockSalesData,
    recentOrders: mockRecentOrders
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch data from the main sheet "Dados Comercial"
        // Range A2:K covers all columns shown in the screenshot
        const sheetData = await fetchSheetData("'Dados Comercial'!A2:K");

        if (sheetData.length > 0) {
          // Process Data
          const processedData = sheetData.map((row, index) => ({
            id: index + 1,
            date: row[0], // A: Data
            team: row[1], // B: Equipe
            salesperson: row[2], // C: Vendedor
            projection: parseCurrency(row[3]), // D: Projeção
            revenue: parseCurrency(row[4]), // E: Processo + Faturamento
            budgetOpen: parseCurrency(row[5]), // F: Orçamento em Aberto
            dailyGoal: parseCurrency(row[6]), // G: Meta Diária
            goalPercent: row[7], // H: % Meta Mensal
            monthlyGoal: parseCurrency(row[8]), // I: Meta Mensal
            campaign: row[9], // J: Campanha
            month: row[10] // K: Mês Venda
          }));

          // 1. Calculate Stats
          const processed = sheetData.map((row, index) => {
            // Parse date "DD/MM/YYYY"
            const dateParts = row[0] ? row[0].split('/') : [];
            const dateObj = dateParts.length === 3
              ? new Date(dateParts[2], dateParts[1] - 1, dateParts[0])
              : null;

            return {
              id: index + 1,
              date: row[0],
              dateObj: dateObj,
              team: row[1],
              salesperson: row[2],
              projection: parseCurrency(row[3]),
              revenue: parseCurrency(row[4]),
              budgetOpen: parseCurrency(row[5]),
              dailyGoal: parseCurrency(row[6]),
              goalPercent: row[7],
              monthlyGoal: parseCurrency(row[8]),
              campaign: row[9],
              month: row[10]
            };
          });

          setRawData(processed);
          // Set selected month to the month of the last entry if current month has no data? 
          // For now, let's stick to current month or the month from the data if available.
          // Actually, let's default to the month present in the data (e.g. November)
          if (processed.length > 0 && processed[processed.length - 1].dateObj) {
            setSelectedMonth(processed[processed.length - 1].dateObj.getMonth());
          }
        }
      } catch (err) {
        console.error("Failed to load Google Sheets data", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (rawData.length === 0) return;

    // Filter by Selected Month
    const filteredData = rawData.filter(item =>
      item.dateObj && item.dateObj.getMonth() === selectedMonth
    );

    // 1. Calculate Stats for the Month
    const totalRevenue = filteredData.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalGoal = filteredData.reduce((acc, curr) => acc + curr.monthlyGoal, 0);
    // Avoid division by zero if totalGoal is 0 (sum of daily rows might duplicate monthly goal? 
    // Usually monthly goal is per salesperson/team. Assuming row contains the goal for that sale/day? 
    // Actually, looking at the sheet, "Meta Mensal" seems to be repeated per row. 
    // We should probably take the unique goals per salesperson/team, but for simplicity let's sum revenue and compare to sum of goals if they are daily goals?
    // Wait, "Meta Mensal" (Col I) is 250.000, 300.000. It's likely the salesperson's monthly goal.
    // We shouldn't sum it for every transaction. We should sum unique salesperson goals.

    const uniqueSellers = [...new Set(filteredData.map(d => d.salesperson))];
    const totalMonthlyGoal = uniqueSellers.reduce((acc, seller) => {
      const sellerRow = filteredData.find(d => d.salesperson === seller);
      return acc + (sellerRow ? sellerRow.monthlyGoal : 0);
    }, 0);

    const activeSellers = uniqueSellers.length;
    const avgTicket = filteredData.length > 0 ? totalRevenue / filteredData.length : 0;

    const newStats = [
      { title: 'Faturamento Mensal', value: totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), change: 'vs Meta', isPositive: true },
      { title: 'Meta do Mês', value: totalMonthlyGoal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), change: `${totalMonthlyGoal > 0 ? ((totalRevenue / totalMonthlyGoal) * 100).toFixed(1) : 0}%`, isPositive: totalRevenue >= totalMonthlyGoal },
      { title: 'Vendedores Ativos', value: activeSellers.toString(), change: 'Total', isPositive: true },
      { title: 'Ticket Médio', value: avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), change: 'Por venda', isPositive: true },
    ];

    // 2. Prepare Chart Data (Daily Sales)
    const salesByDate = filteredData.reduce((acc, curr) => {
      const day = curr.dateObj.getDate();
      if (!acc[day]) acc[day] = 0;
      acc[day] += curr.revenue;
      return acc;
    }, {});

    const newSalesData = Object.keys(salesByDate).map(day => ({
      name: `Dia ${day}`,
      sales: salesByDate[day]
    })).sort((a, b) => parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1]));

    // 3. Recent Orders (Transactions)
    const newRecentOrders = filteredData.slice().reverse().map(item => ({
      id: item.id.toString(),
      customer: item.salesperson, // Showing Salesperson as "Customer" context for internal dashboard? Or Client? Sheet doesn't have Client name.
      // The sheet has "Vendedor" and "Equipe". Let's use Vendedor as the main entity.
      product: item.team,
      amount: item.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      status: item.revenue > 0 ? 'Faturado' : 'Pendente', // Simplified status
      date: item.date
    }));

    setDashboardData({
      stats: newStats,
      salesData: newSalesData,
      recentOrders: newRecentOrders
    });

  }, [rawData, selectedMonth]);

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Visão Geral de Vendas</h2>
          <p className="text-gray-500">Acompanhe o desempenho comercial do Grupo PMD.</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
          >
            {months.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          {loading && <span className="text-sm text-blue-600 animate-pulse">Atualizando...</span>}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <span className="font-medium mr-2">Erro ao carregar dados:</span> {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {dashboardData.stats.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      {/* Charts & Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2">
          <SalesChart data={dashboardData.salesData} />
        </div>

        {/* Recent Orders Section */}
        <div className="lg:col-span-1">
          <RecentOrders orders={dashboardData.recentOrders} />
        </div>
      </div>
    </Layout>
  );
}

export default App;
