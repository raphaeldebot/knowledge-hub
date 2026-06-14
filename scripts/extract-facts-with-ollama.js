const extractor = require("./legacy/extract-facts-with-ollama");

// Wrapper conservé pour les anciennes commandes.
if (require.main === module) {
  extractor.main();
}

module.exports = extractor;
