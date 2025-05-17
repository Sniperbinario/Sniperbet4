// server.js - HÍBRIDO: API-Football + fallback Google
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const puppeteer = require("puppeteer");

const PORT = process.env.PORT || 10000;
app.use(cors());
app.use(express.static("public"));

const API_KEY = "284ce58fecmsha01014ea476b376p179fb2jsn714c3c6f02d8";
const API_HOST = "api-football-v1.p.rapidapi.com";
const headers = {
  "X-RapidAPI-Key": API_KEY,
  "X-RapidAPI-Host": API_HOST,
};

const LEAGUE_IDS = [71, 72, 13, 39, 140, 135];

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function ajustarHorarioBrasilia(dateStr) {
  const data = new Date(dateStr);
  data.setHours(data.getHours() - 3);
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Robô alternativo Google
async function buscarJogosGoogle() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto("https://www.google.com/search?q=brasileirao", {
    waitUntil: "networkidle2",
  });

  const jogos = await page.evaluate(() => {
    const blocos = document.querySelectorAll('[data-league-name]');
    const lista = [];

    blocos.forEach(bloco => {
      const liga = bloco.getAttribute('data-league-name') || "Desconhecida";
      const cards = bloco.querySelectorAll('div.imso_mh__ma-sc');

      cards.forEach(card => {
        const times = card.querySelectorAll(".imso_mh__first-tn-ed,");
        const horario = card.querySelector(".imso_mh__lv-m-stts-cont span")?.innerText || "";

        if (times.length === 2 && horario.includes(":")) {
          const timeCasa = times[0].innerText;
          const timeFora = times[1].innerText;

          lista.push({
            id: Date.now() + Math.random(),
            liga,
            timeCasa,
            timeFora,
            horario,
            logoCasa: "https://via.placeholder.com/30",
            logoFora: "https://via.placeholder.com/30",
          });
        }
      });
    });

    return lista;
  });

  await browser.close();
  return jogos;
}

// Rota principal /games
app.get("/games", async (req, res) => {
  try {
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    const datas = [formatDate(hoje), formatDate(ontem)];
    const promises = [];

    datas.forEach(data => {
      LEAGUE_IDS.forEach(leagueId => {
        promises.push(
          axios.get(`https://${API_HOST}/v3/fixtures`, {
            params: { league: leagueId, date: data },
            headers,
          })
        );
      });
    });

    const results = await Promise.all(promises);
    let jogos = [];

    results.forEach((response) => {
      response.data.response.forEach((jogo) => {
        jogos.push({
          id: jogo.fixture.id,
          horario: ajustarHorarioBrasilia(jogo.fixture.date),
          liga: jogo.league.name,
          timeCasa: jogo.teams.home.name,
          timeFora: jogo.teams.away.name,
          logoCasa: jogo.teams.home.logo,
          logoFora: jogo.teams.away.logo,
        });
      });
    });

    if (jogos.length > 0) {
      return res.json(jogos);
    }

    // Fallback: robô Google
    const alternativo = await buscarJogosGoogle();
    console.log("⚠️ Usando robô Google, jogos encontrados:", alternativo.length);
    return res.json(alternativo);
  } catch (err) {
    console.error("Erro geral:", err.message);
    return res.status(500).json({ erro: "Erro ao buscar jogos" });
  }
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
