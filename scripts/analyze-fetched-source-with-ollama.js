const extractor = require("./legacy/extract-facts-with-ollama");

// Nom conservé pour les anciennes commandes. Le flux actuel produit
// data/raw/research/<slug>/extracted-facts.json et ne modifie plus notes.md.
if (require.main === module) {
  extractor.main();
}

module.exports = extractor;
