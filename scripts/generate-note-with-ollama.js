const generator = require("./legacy/generate-note-from-facts");

// Nom conservé pour compatibilité avec les anciennes commandes.
// La génération est maintenant déterministe à partir de faits JSON validés.
if (require.main === module) {
  generator.main();
}

module.exports = generator;
