
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

const ligas = [39, 140, 135];

const buscarUltimos5Jogos = async (timeId) => {
  const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${timeId}&season=2024&last=5`;
  const response = await fetch(url, { headers });
  const data = await response.json();

  const stats = {
    mediaGolsFeitos: 0,
    mediaGolsSofridos: 0,
    mediaEscanteios: 0,
    mediaCartoes: 0,
    jogosFormatados: []
  };

  data.response.forEach(jogo => {
    const isCasa = jogo.teams.home.id === timeId;
    const golsFeitos = isCasa ? jogo.goals.home : jogo.goals.away;
    const golsSofridos = isCasa ? jogo.goals.away : jogo.goals.home;
    const adversario = isCasa ? jogo.teams.away.name : jogo.teams.home.name;

    const dataFormatada = new Date(jogo.fixture.date).toLocaleDateString('pt-BR');
    stats.jogosFormatados.push(\`\${dataFormatada} - \${golsFeitos}x\${golsSofridos} vs \${adversario}\`);

    stats.mediaGolsFeitos += golsFeitos;
    stats.mediaGolsSofridos += golsSofridos;
    stats.mediaEscanteios += jogo.statistics?.[0]?.statistics?.find(e => e.type === 'Corner Kicks')?.value || 0;
    stats.mediaCartoes += jogo.statistics?.[0]?.statistics?.find(e => e.type === 'Yellow Cards')?.value || 0;
  });

  const total = data.response.length;
  if (total > 0) {
    stats.mediaGolsFeitos = (stats.mediaGolsFeitos / total).toFixed(2);
    stats.mediaGolsSofridos = (stats.mediaGolsSofridos / total).toFixed(2);
    stats.mediaEscanteios = (stats.mediaEscanteios / total).toFixed(2);
    stats.mediaCartoes = (stats.mediaCartoes / total).toFixed(2);
  }

  return stats;
};

const buscarPosicaoTabela = async (leagueId, teamId) => {
  const url = \`https://api-football-v1.p.rapidapi.com/v3/standings?league=\${leagueId}&season=2024\`;
  const response = await fetch(url, { headers });
  const data = await response.json();

  const tabela = data.response[0]?.league?.standings[0];
  const timeInfo = tabela?.find(entry => entry.team.id === teamId);
  return timeInfo ? timeInfo.rank : null;
};

app.get('/ultimos-jogos', async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const jogos = [];

    for (const liga of ligas) {
      const url = \`https://api-football-v1.p.rapidapi.com/v3/fixtures?league=\${liga}&season=2024&date=\${hoje}\`;
      const response = await fetch(url, { headers });
      const data = await response.json();
      jogos.push(...data.response.map(j => ({ ...j, liga })));
    }

    const jogosComDados = await Promise.all(jogos.map(async (jogo) => {
      const home = jogo.teams.home;
      const away = jogo.teams.away;

      const estatisticasHome = await buscarUltimos5Jogos(home.id);
      const estatisticasAway = await buscarUltimos5Jogos(away.id);

      const posicaoCasa = await buscarPosicaoTabela(jogo.liga, home.id);
      const posicaoFora = await buscarPosicaoTabela(jogo.liga, away.id);

      return {
        data: jogo.fixture.date,
        horario: new Date(jogo.fixture.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timeCasa: home.name,
        timeFora: away.name,
        logoCasa: home.logo,
        logoFora: away.logo,
        estatisticasHome,
        estatisticasAway,
        ultimosJogosCasa: estatisticasHome.jogosFormatados,
        ultimosJogosFora: estatisticasAway.jogosFormatados,
        posicaoCasa,
        posicaoFora
      };
    }));

    res.json({ jogos: jogosComDados });
  } catch (err) {
    console.error('Erro ao buscar jogos:', err);
    res.status(500).json({ erro: 'Erro ao buscar jogos' });
  }
});

app.listen(port, () => {
  console.log(\`Servidor rodando na porta \${port}\`);
});
