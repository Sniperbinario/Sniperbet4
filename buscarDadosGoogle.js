const puppeteer = require("puppeteer");

async function buscarDadosGoogle(jogo) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  const termoBusca = `${jogo} ao vivo site:google.com`;

  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(termoBusca)}`, {
    waitUntil: "domcontentloaded",
  });

  try {
    await page.waitForSelector('div[data-attrid="kc:/sports_competition:live_score_card"]', { timeout: 10000 });
  } catch {
    await browser.close();
    return { erro: "Painel ao vivo não encontrado no Google." };
  }

  const dados = await page.evaluate(() => {
    const container = document.querySelector('div[data-attrid="kc:/sports_competition:live_score_card"]');
    if (!container) return null;

    const texto = container.innerText;

    return {
      fonte: "Google",
      textoCompleto: texto,
      escanteios: (texto.match(/Escanteios\\s+(\\d+)/i) || [])[1] || 'N/D',
      chutes: (texto.match(/Chutes\\s+(\\d+)/i) || [])[1] || 'N/D',
      cartoes: (texto.match(/Cartões amarelos\\s+(\\d+)/i) || [])[1] || 'N/D',
      gols: (texto.match(/(\\d+)\\s+x\\s+(\\d+)/i) || []).slice(1, 3).join('x') || 'N/D',
      tempo: (texto.match(/\\d+º tempo - \\d+ min/) || [])[0] || 'Em andamento',
    };
  });

  await browser.close();
  return dados;
}

module.exports = buscarDadosGoogle;
