const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const chromium = require("chrome-aws-lambda");
const puppeteer = require("puppeteer-core");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.static(path.join(__dirname)));

const headers = {
  "X-RapidAPI-Key": process.env.API_KEY_FOOTBALL,
  "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
};

const ligas = [39, 140, 135, 78, 13]; // Premier, La Liga, Serie A, Série B, Libertadores
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

const buscarEstatisticas = async (teamId) => {
  try {
    const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&season=${temporada}&last=20`;
    const response = await fetch(url, { headers });
    const data = await response.json();

    const jogosFinalizados = data.response
      .filter(j => j.fixture.status.short === "FT")
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .slice(0, 5);

    let mediaGolsFeitos = 0;
    let mediaGolsSofridos = 0;
    let mediaEscanteios = 0;
    let mediaCartoes = 0;
    let mediaChutesTotais = 0;
    let mediaChutesGol = 0;
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

      const getStat = (tipo) => stats.find(s => s.type === tipo)?.value ?? 0;

      mediaGolsFeitos += golsFeitos;
      mediaGolsSofridos += golsSofridos;
      mediaEscanteios += getStat("Corner Kicks");
      mediaCartoes += getStat("Yellow Cards");
      mediaChutesTotais += getStat("Total Shots");
      mediaChutesGol += getStat("Shots on Goal");

      const dataJogo = new Date(jogo.fixture.date).toLocaleDateString("pt-BR");
      const timeMandante = jogo.teams.home.name;
      const timeVisitante = jogo.teams.away.name;
      const placar = `${jogo.goals.home}x${jogo.goals.away}`;
      const local = isCasa ? "(casa)" : "(fora)";
      ultimosJogos.push({ texto: `${dataJogo} — ${timeMandante} ${placar} ${timeVisitante} ${local}` });
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
    const timeInfo = tabela?.find((entry) => entry.team.id === teamId);
    return timeInfo?.rank || "N/D";
  } catch {
    return "N/D";
  }
};

app.get("/ultimos-jogos", async (req, res) => {
  try {
    const brasiliaDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hoje = brasiliaDate.toISOString().split("T")[0];
    const jogos = [];

    for (const liga of ligas) {
      const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${liga}&season=${temporada}`;
      const response = await fetch(url, { headers });
      const data = await response.json();
      if (!Array.isArray(data.response)) continue;
      const jogosDoDia = data.response.filter(j => j.fixture.date.includes(hoje));
      jogos.push(...jogosDoDia.map(j => ({ ...j, ligaId: liga })));
    }

    const jogosCompletos = await Promise.all(jogos.map(async (jogo) => {
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
    }));

    res.json({ jogos: jogosCompletos });
  } catch (err) {
    console.error("Erro geral:", err);
    res.status(500).json({ erro: "Erro ao buscar jogos" });
  }
});

app.get("/analise-ao-vivo", async (req, res) => {
  const jogo = req.query.jogo;
  if (!jogo) return res.status(400).json({ erro: "Parâmetro 'jogo' é obrigatório" });

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(jogo)}+ao+vivo`, {
      waitUntil: "domcontentloaded",
    });

    await page.waitForSelector("div[data-attrid]", { timeout: 15000 });
    const dados = await page.evaluate(() => {
      const container = document.querySelector("div[data-attrid]");
      const texto = container?.innerText || '';
      return {
        textoBruto: texto,
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
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`🔥 SniperBet rodando na porta ${port}`);
});
