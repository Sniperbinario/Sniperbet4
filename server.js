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
app.use(express.static(path.join(__dirname, 'public')));

const headers = {
  "X-RapidAPI-Key": process.env.API_KEY_FOOTBALL,
  "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
};

const ligas = [13, 71, 72, 39, 140, 135];
const temporada = new Date().getFullYear();

const estatisticasZeradas = () => ({
  mediaGolsFeitos: '0.00',
  mediaGolsSofridos: '0.00',
  mediaEscanteios: '0.00',
  mediaCartoes: '0.00',
  mediaChutesTotais: '0.00',
  mediaChutesGol: '0.00',
  ultimosJogos: []
});

async function buscarEstatisticas(teamId) {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&season=${temporada}&last=20`;
    const response = await fetch(url, { headers });
    const data = await response.json();

    const jogos = data.response.filter(j => j.fixture.status.short === "FT").slice(0, 5);
    let media = { ...estatisticasZeradas(), total: 0 };

    for (const jogo of jogos) {
      const isCasa = jogo.teams.home.id === teamId;
      const golsFeitos = isCasa ? jogo.goals.home : jogo.goals.away;
      const golsSofridos = isCasa ? jogo.goals.away : jogo.goals.home;

      const statsUrl = `https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${jogo.fixture.id}`;
      const statsRes = await fetch(statsUrl, { headers });
      const statsData = await statsRes.json();
      const stats = statsData?.response?.find(r => r.team?.id === teamId)?.statistics || [];

      const get = tipo => stats.find(s => s.type === tipo)?.value ?? 0;

      media.mediaGolsFeitos = (parseFloat(media.mediaGolsFeitos) + golsFeitos).toFixed(2);
      media.mediaGolsSofridos = (parseFloat(media.mediaGolsSofridos) + golsSofridos).toFixed(2);
      media.mediaEscanteios = (parseFloat(media.mediaEscanteios) + get("Corner Kicks")).toFixed(2);
      media.mediaCartoes = (parseFloat(media.mediaCartoes) + get("Yellow Cards")).toFixed(2);
      media.mediaChutesTotais = (parseFloat(media.mediaChutesTotais) + get("Total Shots")).toFixed(2);
      media.mediaChutesGol = (parseFloat(media.mediaChutesGol) + get("Shots on Goal")).toFixed(2);

      const texto = `${new Date(jogo.fixture.date).toLocaleDateString("pt-BR")} — ${jogo.teams.home.name} ${jogo.goals.home}x${jogo.goals.away} ${jogo.teams.away.name} ${isCasa ? "(casa)" : "(fora)"}`;
      media.ultimosJogos.push({ texto });
    }

    const count = jogos.length || 1;
    for (const key of Object.keys(media)) {
      if (key !== "ultimosJogos")
        media[key] = (parseFloat(media[key]) / count).toFixed(2);
    }

    return media;
  } catch {
    return estatisticasZeradas();
  }
}

async function buscarPosicaoTabela(ligaId, teamId) {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/standings?league=${ligaId}&season=${temporada}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    const posicao = data.response[0]?.league?.standings[0]?.find(t => t.team.id === teamId)?.rank;
    return posicao || "N/D";
  } catch {
    return "N/D";
  }
}

app.get("/ultimos-jogos", async (req, res) => {
  try {
    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const jogos = [];

    for (const liga of ligas) {
      const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${liga}&season=${temporada}`;
      const response = await fetch(url, { headers });
      const data = await response.json();

      const jogosHoje = data.response.filter(j =>
        new Date(j.fixture.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === hoje
      );

      jogos.push(...jogosHoje.map(j => ({ ...j, ligaId: liga })));
    }

    const jogosCompletos = await Promise.all(jogos.map(async jogo => {
      const home = jogo.teams.home;
      const away = jogo.teams.away;

      const estatisticasHome = await buscarEstatisticas(home.id);
      const estatisticasAway = await buscarEstatisticas(away.id);

      const posicaoCasa = await buscarPosicaoTabela(jogo.ligaId, home.id);
      const posicaoFora = await buscarPosicaoTabela(jogo.ligaId, away.id);

      const horario = new Date(jogo.fixture.date).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit"
      });

      return {
        timeCasa: home.name,
        timeFora: away.name,
        logoCasa: home.logo,
        logoFora: away.logo,
        horario,
        data: jogo.fixture.date,
        estatisticasHome,
        estatisticasAway,
        posicaoCasa,
        posicaoFora
      };
    }));

    res.json({ jogos: jogosCompletos });
  } catch (err) {
    console.error("Erro geral:", err.message);
    res.status(500).json({ erro: "Erro ao buscar jogos" });
  }
});

app.get("/analise-ao-vivo", async (req, res) => {
  const jogo = req.query.jogo;
  if (!jogo) return res.status(400).json({ erro: "Parâmetro 'jogo' é obrigatório" });

  try {
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();

    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(jogo)}+ao+vivo`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("div[data-attrid]", { timeout: 10000 });

    const dados = await page.evaluate(() => {
      const container = document.querySelector("div[data-attrid]");
      return {
        textoBruto: container?.innerText || "Dados não encontrados.",
        ultimaAtualizacao: new Date().toLocaleString("pt-BR")
      };
    });

    await browser.close();
    res.json(dados);
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao buscar dados ao vivo", detalhe: erro.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`🔥 SniperBet rodando na porta ${port}`);
});
