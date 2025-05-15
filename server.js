const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const buscarDadosGoogle = require("./buscarDadosGoogle");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.static(path.join(__dirname)));

const headers = {
  "X-RapidAPI-Key": process.env.API_KEY_FOOTBALL,
  "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
};

const ligas = [39, 140, 135, 78, 13];
const temporada = new Date().getFullYear();

const buscarEstatisticasJogo = async (fixtureId) => {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${fixtureId}`;
    const response = await fetch(url, { headers });
    const data = await response.json();
    return data.response || [];
  } catch (err) {
    return [];
  }
};

const buscarEstatisticas = async (timeId) => {
  const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${timeId}&season=${temporada}&last=20`;
  const response = await fetch(url, { headers });
  const data = await response.json();

  if (!data.response || !Array.isArray(data.response)) {
    return estatisticasZeradas();
  }

  let mediaGolsFeitos = 0;
  let mediaGolsSofridos = 0;
  let mediaEscanteios = 0;
  let mediaCartoes = 0;
  let mediaChutesTotais = 0;
  let mediaChutesGol = 0;
  const ultimosJogos = [];

  const jogosFinalizados = data.response
    .filter(j => j.fixture.status.short === "FT")
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
    .slice(0, 5);

  for (const jogo of jogosFinalizados) {
    const isCasa = jogo.teams.home.id === timeId;
    const golsFeitos = isCasa ? jogo.goals.home : jogo.goals.away;
    const golsSofridos = isCasa ? jogo.goals.away : jogo.goals.home;

    const timeMandante = jogo.teams.home.name;
    const timeVisitante = jogo.teams.away.name;
    const placar = `${jogo.goals.home}x${jogo.goals.away}`;
    const dataJogo = new Date(jogo.fixture.date).toLocaleDateString("pt-BR");
    const local = isCasa ? "(casa)" : "(fora)";

    ultimosJogos.push({
      texto: `${dataJogo} — ${timeMandante} ${placar} ${timeVisitante} ${local}`
    });

    const statsDetalhadas = await buscarEstatisticasJogo(jogo.fixture.id);
    const stats = statsDetalhadas?.[0]?.statistics || [];
    const getStat = (type) => stats.find(s => s.type === type)?.value;

    mediaGolsFeitos += golsFeitos;
    mediaGolsSofridos += golsSofridos;
    mediaEscanteios += getStat("Corner Kicks") ?? 5;
    mediaCartoes += getStat("Yellow Cards") ?? 2;
    mediaChutesTotais += getStat("Total Shots") ?? 6;
    mediaChutesGol += getStat("Shots on Goal") ?? 2;
  }

  const total = jogosFinalizados.length || 1;

  return {
    mediaGolsFeitos: (mediaGolsFeitos / total).toFixed(2),
    mediaGolsSofridos: (mediaGolsSofridos / total).toFixed(2),
    mediaEscanteios: (mediaEscanteios / total).toFixed(2),
    mediaCartoes: (mediaCartoes / total).toFixed(2),
    mediaChutesTotais: (mediaChutesTotais / total).toFixed(2),
    mediaChutesGol: (mediaChutesGol / total).toFixed(2),
    ultimosJogos
  };
};

const estatisticasZeradas = () => ({
  mediaGolsFeitos: '0.00',
  mediaGolsSofridos: '0.00',
  mediaEscanteios: '0.00',
  mediaCartoes: '0.00',
  mediaChutesTotais: '0.00',
  mediaChutesGol: '0.00',
  ultimosJogos: []
});

const buscarPosicaoTabela = async (ligaId, teamId) => {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/standings?league=${ligaId}&season=${temporada}`;
    const response = await fetch(url, { headers });
    const data = await response.json();
    const tabela = data.response[0]?.league?.standings[0];
    const timeInfo = tabela?.find((entry) => entry.team.id === teamId);
    return timeInfo?.rank || "N/D";
  } catch {
    return "N/D";
  }
};

app.get("/ultimos-jogos", async (req, res) => {
  try {
    const brasiliaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hoje = brasiliaDate.toISOString().split('T')[0];
    const jogos = [];

    for (const liga of ligas) {
      try {
        const url = liga === 13
          ? `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=13&season=${temporada}`
          : `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${liga}&season=${temporada}&date=${hoje}`;

        const response = await fetch(url, { headers });
        const data = await response.json();

        if (!data.response || !Array.isArray(data.response)) continue;

        jogos.push(...data.response.map((jogo) => ({ ...jogo, ligaId: liga })));
      } catch (erroLiga) {
        console.error(`Erro ao buscar jogos da liga ${liga}:`, erroLiga.message);
      }
    }

    const jogosCompletos = await Promise.all(
      jogos.map(async (jogo) => {
        const home = jogo.teams.home;
        const away = jogo.teams.away;

        const estatisticasHome = await buscarEstatisticas(home.id);
        const estatisticasAway = await buscarEstatisticas(away.id);

        const posicaoCasa = await buscarPosicaoTabela(jogo.ligaId, home.id);
        const posicaoFora = await buscarPosicaoTabela(jogo.ligaId, away.id);

        const horarioBrasilia = new Date(jogo.fixture.date).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit"
        });

        return {
          data: jogo.fixture.date,
          horario: horarioBrasilia,
          timeCasa: home.name,
          timeFora: away.name,
          logoCasa: home.logo,
          logoFora: away.logo,
          estatisticasHome,
          estatisticasAway,
          posicaoCasa,
          posicaoFora,
          ultimosJogosCasa: estatisticasHome.ultimosJogos,
          ultimosJogosFora: estatisticasAway.ultimosJogos
        };
      })
    );

    res.json({ jogos: jogosCompletos });
  } catch (error) {
    console.error("Erro geral:", error);
    res.status(500).json({ erro: "Erro ao buscar jogos" });
  }
});

app.get("/analise-ao-vivo", async (req, res) => {
  const jogo = req.query.jogo;
  if (!jogo) return res.status(400).json({ erro: "Parâmetro 'jogo' é obrigatório" });

  try {
    const dados = await buscarDadosGoogle(jogo);
    dados.ultimaAtualizacao = new Date().toLocaleString("pt-BR");
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao buscar dados ao vivo", detalhe: erro.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`🔥 SniperBet rodando na porta ${port}`);
});
