process.env.PUPPETEER_CACHE_DIR = './.cache/puppeteer';

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const puppeteer = require("puppeteer");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.static(__dirname));

const headers = {
  "X-RapidAPI-Key": process.env.API_KEY_FOOTBALL,
  "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
};

const ligas = [13, 71, 72, 39, 140, 135];
const temporada = new Date().getFullYear();

async function buscarJogosViaGoogle(ligaNome) {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(ligaNome + ' jogos hoje')}`);

  const jogos = await page.evaluate(() => {
    const partidas = [];
    const elementos = document.querySelectorAll("div.imso_gs__tli");
    elementos.forEach(el => {
      const times = el.innerText.match(/.+ vs .+/);
      if (times) partidas.push(times[0]);
    });
    return partidas;
  });

  await browser.close();

  return jogos.map(nome => ({
    timeCasa: nome.split(" vs ")[0].trim(),
    timeFora: nome.split(" vs ")[1].trim(),
    data: new Date().toISOString(),
    horario: "--:--",
    logoCasa: "https://via.placeholder.com/30",
    logoFora: "https://via.placeholder.com/30",
    estatisticasHome: {},
    estatisticasAway: {},
    posicaoCasa: "N/D",
    posicaoFora: "N/D",
    ultimosJogosCasa: [],
    ultimosJogosFora: [],
    fonte: "Robô Google"
  }));
}

const estatisticasZeradas = () => ({
  mediaGolsFeitos: '0.00',
  mediaGolsSofridos: '0.00',
  mediaEscanteios: '0.00',
  mediaCartoes: '0.00',
  mediaChutesTotais: '0.00',
  mediaChutesGol: '0.00',
  ultimosJogos: []
});

const buscarEstatisticas = async (teamId) => {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&season=${temporada}&last=20`;
    const response = await fetch(url, { headers });
    const data = await response.json();
    const jogosFinalizados = data.response.filter(j => j.fixture.status.short === "FT").slice(0, 5);

    let mediaGolsFeitos = 0, mediaGolsSofridos = 0, mediaEscanteios = 0, mediaCartoes = 0, mediaChutesTotais = 0, mediaChutesGol = 0;
    const ultimosJogos = [];

    for (const jogo of jogosFinalizados) {
      const isCasa = jogo.teams.home.id === teamId;
      const golsFeitos = isCasa ? jogo.goals.home : jogo.goals.away;
      const golsSofridos = isCasa ? jogo.goals.away : jogo.goals.home;

      const statsUrl = `https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${jogo.fixture.id}`;
      const statsResponse = await fetch(statsUrl, { headers });
      const statsData = await statsResponse.json();
      const statsEntry = statsData?.response?.find(r => r.team?.id === teamId);
      const stats = statsEntry?.statistics || [];

      const getStat = tipo => stats.find(s => s.type === tipo)?.value ?? 0;
      mediaGolsFeitos += golsFeitos;
      mediaGolsSofridos += golsSofridos;
      mediaEscanteios += getStat("Corner Kicks");
      mediaCartoes += getStat("Yellow Cards");
      mediaChutesTotais += getStat("Total Shots");
      mediaChutesGol += getStat("Shots on Goal");

      ultimosJogos.push({ texto: `${new Date(jogo.fixture.date).toLocaleDateString("pt-BR")} — ${jogo.teams.home.name} ${jogo.goals.home}x${jogo.goals.away} ${jogo.teams.away.name} ${isCasa ? "(casa)" : "(fora)"}` });
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
  } catch (err) {
    console.error("Erro buscarEstatisticas:", err.message);
    return estatisticasZeradas();
  }
};

const buscarPosicaoTabela = async (ligaId, teamId) => {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/standings?league=${ligaId}&season=${temporada}`;
    const response = await fetch(url, { headers });
    const data = await response.json();
    const tabela = data.response[0]?.league?.standings[0];
    const timeInfo = tabela?.find(entry => entry.team.id === teamId);
    return timeInfo?.rank || "N/D";
  } catch {
    return "N/D";
  }
};

app.get("/ultimos-jogos", async (req, res) => {
  try {
    const brasiliaDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dataHojeBrasilia = brasiliaDate.toLocaleDateString("pt-BR");
    const jogos = [];

    for (const liga of ligas) {
      const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${liga}&season=${temporada}`;
      const response = await fetch(url, { headers });
      const data = await response.json();
      if (!Array.isArray(data.response)) continue;

      const jogosDoDia = data.response.filter(j => {
        const dataJogoBrasilia = new Date(j.fixture.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        return dataJogoBrasilia === dataHojeBrasilia;
      });

      if (jogosDoDia.length === 0) {
        const nomeLiga = liga === 39 ? "Premier League" : liga === 13 ? "Libertadores" : "futebol";
        const jogosBackup = await buscarJogosViaGoogle(nomeLiga);
        jogos.push(...jogosBackup);
      } else {
        jogos.push(...jogosDoDia.map(j => ({ ...j, ligaId: liga })));
      }
    }

    const jogosCompletos = await Promise.all(jogos.map(async (jogo) => {
      if (jogo.fonte === "Robô Google") return jogo;
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
        logoCasa:
