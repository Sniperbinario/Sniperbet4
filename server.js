
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());

const headers = {
  'X-RapidAPI-Key': process.env.API_KEY_FOOTBALL,
  'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
};

const ligas = [13, 39, 140, 135, 71, 78]; // Libertadores, Premier, La Liga, Serie A ITA, Serie B BR, Serie A BR

const buscarEstatisticas = async (teamId) => {
  const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&season=2024&last=5`;
  const response = await fetch(url, { headers });
  const data = await response.json();

  const jogos = data.response;
  const stats = {
    mediaGolsFeitos: 0,
    mediaGolsSofridos: 0,
    mediaEscanteios: 0,
    ultimosJogos: []
  };

  for (const jogo of jogos) {
    const isCasa = jogo.teams.home.id === teamId;
    const golsFeitos = isCasa ? jogo.goals.home : jogo.goals.away;
    const golsSofridos = isCasa ? jogo.goals.away : jogo.goals.home;
    const adversario = isCasa ? jogo.teams.away.name : jogo.teams.home.name;
    const local = isCasa ? "(casa)" : "(fora)";
    const dataJogo = new Date(jogo.fixture.date).toLocaleDateString('pt-BR');
    stats.ultimosJogos.push(`${dataJogo} – ${golsFeitos}x${golsSofridos} vs ${adversario} ${local}`);
    stats.mediaGolsFeitos += golsFeitos;
    stats.mediaGolsSofridos += golsSofridos;
    stats.mediaEscanteios += jogo.statistics?.[0]?.statistics?.find(e => e.type === 'Corner Kicks')?.value || 0;
  }

  const total = jogos.length;
  if (total > 0) {
    stats.mediaGolsFeitos = (stats.mediaGolsFeitos / total).toFixed(2);
    stats.mediaGolsSofridos = (stats.mediaGolsSofridos / total).toFixed(2);
    stats.mediaEscanteios = (stats.mediaEscanteios / total).toFixed(2);
  }

  return stats;
};

const buscarPosicaoTabela = async (leagueId, teamId) => {
  const url = `https://api-football-v1.p.rapidapi.com/v3/standings?league=${leagueId}&season=2024`;
  const response = await fetch(url, { headers });
  const data = await response.json();
  const tabela = data.response[0]?.league?.standings[0];
  const timeInfo = tabela?.find(entry => entry.team.id === teamId);
  return timeInfo ? timeInfo.rank : null;
};

const buscarDestaque = async (teamId) => {
  const url = `https://api-football-v1.p.rapidapi.com/v3/players?team=${teamId}&season=2024`;
  const response = await fetch(url, { headers });
  const data = await response.json();
  const jogadores = data.response;
  if (!jogadores.length) return "N/D";
  const destaque = jogadores.reduce((prev, curr) => {
    const pGols = prev.statistics?.[0]?.goals?.total || 0;
    const cGols = curr.statistics?.[0]?.goals?.total || 0;
    return cGols > pGols ? curr : prev;
  });
  return destaque.player.name || "N/D";
};

app.get('/ultimos-jogos', async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const jogos = [];

    for (const liga of ligas) {
      const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${liga}&season=2024&date=${hoje}`;
      const response = await fetch(url, { headers });
      const data = await response.json();
      console.log(`[${new Date().toLocaleTimeString()}] Liga ${liga} - Jogos encontrados:`, data.response.length);
      jogos.push(...data.response.map(j => ({ ...j, ligaId: liga })));
    }

    const jogosCompletos = await Promise.all(jogos.map(async (jogo) => {
      const home = jogo.teams.home;
      const away = jogo.teams.away;

      const estatisticasHome = await buscarEstatisticas(home.id);
      const estatisticasAway = await buscarEstatisticas(away.id);
      const posicaoCasa = await buscarPosicaoTabela(jogo.ligaId, home.id);
      const posicaoFora = await buscarPosicaoTabela(jogo.ligaId, away.id);
      const destaqueCasa = await buscarDestaque(home.id);
      const destaqueFora = await buscarDestaque(away.id);

      return {
        data: jogo.fixture.date,
        horario: new Date(jogo.fixture.date).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        }),
        timeCasa: home.name,
        timeFora: away.name,
        logoCasa: home.logo,
        logoFora: away.logo,
        estatisticasHome,
        estatisticasAway,
        ultimosJogosCasa: estatisticasHome.ultimosJogos,
        ultimosJogosFora: estatisticasAway.ultimosJogos,
        posicaoCasa,
        posicaoFora,
        destaqueCasa,
        destaqueFora
      };
    }));

    res.json({ jogos: jogosCompletos });
  } catch (error) {
    console.error("Erro geral:", error);
    res.status(500).json({ erro: 'Erro ao buscar jogos' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
