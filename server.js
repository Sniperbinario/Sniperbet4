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
  const ultimosJogos = [];

  for (const jogo of data.response) {
    const isCasa = jogo.teams.home.id === timeId;
    const timeMandante = jogo.teams.home.name;
    const timeVisitante = jogo.teams.away.name;

    const golsFeitos = isCasa ? jogo.goals.home : jogo.goals.away;
    const golsSofridos = isCasa ? jogo.goals.away : jogo.goals.home;
    const placar = `${jogo.goals.home}x${jogo.goals.away}`;
    const dataJogo = new Date(jogo.fixture.date).toLocaleDateString("pt-BR");
    const local = isCasa ? "(casa)" : "(fora)";
    ultimosJogos.push(`${dataJogo} — ${timeMandante} ${placar} ${timeVisitante} ${local}`);

    mediaGolsFeitos += golsFeitos;
    mediaGolsSofridos += golsSofridos;
  }

  const total = data.response.length || 1;
  return {
    mediaGolsFeitos: (mediaGolsFeitos / total).toFixed(2),
    mediaGolsSofridos: (media
