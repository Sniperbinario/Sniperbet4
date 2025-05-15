const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const buscarDadosGoogle = require("./buscarDadosGoogle");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());

const headers = {
  "X-RapidAPI-Key": process.env.API_KEY_FOOTBALL,
  "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
};

const ligas = [39, 140, 135, 78, 13]; // Premier League, La Liga, Serie A, Série B, Libertadores

const buscarEstatisticas = async (timeId) => {
  const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${timeId}&season=2024&last=5`;
  const response = await fetch(url, { headers });
  const data = await response.json();

  let mediaGolsFeitos = 0;
  let mediaGolsSofridos = 0;
  let mediaEscanteios = 0;
  let mediaCartoes = 0;
  let mediaChutes = 0;

  const ultimosJogos = [];

  for (const jogo of data.response) {
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

    mediaGolsFeitos += golsFeitos;
    mediaGolsSofridos += golsSofridos;
    mediaEscanteios += 5; // pode substituir por valor real no futuro
    mediaCartoes += 2;
    mediaChutes += 6;
  }

  const total = data.response.length || 1;

  return {
    mediaGolsFeitos: (mediaGolsFeitos / total).toFixed(2),
    mediaGolsSofridos: (mediaGolsSofridos / total).toFixed(2),
    mediaEscanteios: (mediaEscanteios / total).toFixed(2),
    mediaCartoes: (mediaCartoes / total).toFixed(2),
    mediaChutes: (mediaChutes / total).toFixed(2),
    ultimosJogos
  };
};

const buscarPosicaoTabela = async (ligaId, teamId) => {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/standings?league=${ligaId}&season=2024`;
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
    const hoje = new Date().toISOString().split("T")[0];
    const jogos = [];

    for (const liga of ligas) {
      const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${liga}&season=2024&date=${hoje}`;
      const response = await fetch(url, { headers });
      const data = await response.json();
      jogos.push(...data.response.map((jogo) => ({ ...jogo, ligaId: liga })));
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
          ultimosJogosFora: estatisticasAway.ultimosJogos,
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

app.listen(port, () => {
  console.log(`🔥 SniperBet rodando na porta ${port}`);
});
