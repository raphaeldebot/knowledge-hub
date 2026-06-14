const pipeline = require("./legacy/run-research-pipeline");

// Wrapper conservé pour les anciennes commandes.
if (require.main === module) {
  pipeline.main();
}

module.exports = pipeline;
