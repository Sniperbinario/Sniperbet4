const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const port = process.env.PORT || 10000;

// Permitir CORS
app.use(cors());

// Servir arquivos estáticos (index.html, style.css, etc.)
app.use(express.static(path.join(__dirname)));

// Rota principal (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`🔥 SniperBet rodando na porta ${port}`);
});
