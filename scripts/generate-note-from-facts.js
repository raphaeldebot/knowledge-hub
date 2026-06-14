const generator = require("./legacy/generate-note-from-facts");

// Wrapper conservé pour les anciennes commandes.
if (require.main === module) {
  generator.main();
}

module.exports = generator;
