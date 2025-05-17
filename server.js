const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const puppeteer = require("puppeteer");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.static(path.join(__dirname)));

const headers = {
  "X-RapidAPI-Key": process.env.API_KEY_FOOTBALL,
  "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
};

const ligas = [13, 71, 72, 39, 140, 135];
const temporada = new Date().getFullYear();

async function buscarJogosViaGoogle(ligaNome) {
  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(ligaNome + ' jogos hoje')}`, { waitUntil: "domcontentloaded" });

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
  } catch (err) {
    console.error("Erro no robô Google:", err.message);
    return [];
  }
}

app.get("/ultimos-jogos", async (req, res) => {
  res.json({ jogos: [] }); // pode conectar API ou robô aqui
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`🔥 SniperBet rodando na porta ${port}`);
});
