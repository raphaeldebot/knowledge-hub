# Pipeline legacy

Ce dossier conserve l'ancien pipeline expérimental fondé sur :

- l'extraction de faits JSON structurés ;
- la provenance par fait ;
- les profils `recipe`, `technical` et `historical` ;
- les compléments déterministes ;
- la génération Markdown depuis les faits ;
- les contrats et validations associés.

Ce code est gardé comme référence technique et pour permettre l'exécution de
ses tests déterministes. Il n'est pas utilisé par le MVP actuellement
recommandé, dont le point d'entrée est `scripts/run-research-mvp.js`.

Ne pas relancer ni modifier ce pipeline sans besoin explicite. Les anciens
points d'entrée présents à la racine de `scripts/` sont seulement des wrappers
de compatibilité.
