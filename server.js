const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
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
    const logoMandante = jogo.teams.home.logo;
    const logoVisitante = jogo.teams.away.logo;
    const placar = `${jogo.goals.home}x${jogo.goals.away}`;
    const dataJogo = new Date(jogo.fixture.date).toLocaleDateString("pt-BR");
    const local = isCasa ? "(casa)" : "(fora)";

    ultimosJogos.push({
      texto: `${dataJogo} — ${timeMandante} ${placar} ${timeVisitante} ${local}`,
      logoCasa: logoMandante,
      logoFora: logoVisitante
    });

    mediaGolsFeitos += golsFeitos;
    mediaGolsSofridos += golsSofridos;
    mediaEscanteios += 5;
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
