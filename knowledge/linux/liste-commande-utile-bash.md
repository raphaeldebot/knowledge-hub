---
title: "Liste commande utile bash"
topic: "linux"
level: "beginner"
tags: ["liste", "commande", "utile", "bash", "aide-memoire"]
source_type: "web_saved"
source_id: "https://serverspace.io/fr/support/help/bash-cheat-sheet/"
confidence: "medium"
status: "draft"
updated: "2026-06-19"
---

# Liste commande utile bash

## Aide-mémoire des commandes Bash par catégorie

### Exécution de commandes et de programmes
- **Fonction** : Lancez des programmes, des utilitaires et des scripts.
- **Commandes/Constructions** : `ls`, `grep`, `mkdir`, `cd`, `chmod`, `./script.sh`, `bash`.

### Automatisation et script
- **Fonction** : Créez et exécutez des scripts, des conditions, des boucles.
- **Commandes/Constructions** : `if`, `for`, `while`, `function`, `case`, `exit`, `test`.

### Variables et gestion des données
- **Fonction** : Créer des variables, des opérations arithmétiques et des chaînes.
- **Commandes/Constructions** : `var=valeur`, `export`, `unset`, `${var}`, `$((expression))`.

### Gestion des processus et des signaux
- **Fonction** : Gérer les processus et les signaux.
- **Commandes/Constructions** : `&` (arrière-plan), `kill`, `killall`, `jobs`, `fg`, `bg`, `Ctrl+C` (SIGINT), `Ctrl+Z` (SIGTSTP).

### Redirection d'E/S et tuyaux
- **Fonction** : Contrôler les flux de données.
- **Commandes/Constructions** : `>`, `>>`, `2>`, `&>`, `|`.

### Gestion et globalisation des systèmes de fichiers
- **Fonction** : Navigation, opérations sur les fichiers, correspondance de modèles.
- **Commandes/Constructions** : `cp`, `mv`, `rm`, `find`, `grep`, `*`, `?`.

### Substitutions (expansion des paramètres)
- **Fonction** : Manipulation de chaînes et arithmétique.
- **Commandes/Constructions** : `${var//search/replace}`, `${file##*/}`, `$((expression))`.

### Raccourcis
- **Saisie semi-automatique** : `Tab` — nom de fichier/commande de saisie semi-automatique ; `Double Tab` — afficher toutes les options.
- **Historique** : `Ctrl + R` — historique de recherche ; `!!` — répéter la dernière commande ; `!$` — utiliser le dernier argument de la commande précédente.

### Pro Tips
- **Alias** : `alias ll='ls -alh'` — ajouter à `~/.bashrc`.
- **Utilisation de l'historique** : `history | grep "git"` — trouver toutes les commandes "git".
- **Correction rapide** : `^old^new` — remplacer "old" par "new" dans la dernière commande.

### FAQ : Aide-mémoire Bash

**Q1 : Qu'est-ce que Bash et pourquoi devrais-je l'utiliser ?**  
A1 : Bash (Bourne-Again Shell) est l'interpréteur de commandes par défaut pour les systèmes de type Unix. Il combine automatisation, scripts et gestion des processus, ce qui le rend idéal pour l'administration de serveurs, les tâches d'automatisation et le travail quotidien sur les terminaux.

**Q2 : Comment créer et utiliser des variables dans Bash ?**  
A2 : Vous pouvez définir une variable locale avec `name="value"` et y accéder via `$name`. Pour la rendre accessible aux processus enfants, utilisez `export name=value`. Des variables spéciales comme `$?`, `$$` et `$PATH` fournissent l'état de sortie de la commande, l'ID du processus et les chemins système.

**Q3 : Comment puis-je gérer les processus dans Bash ?**  
A3 : Utilisez `&` pour exécuter des commandes en arrière-plan, `fg` et `bg` pour reprendre les tâches, et `Ctrl+C` ou `kill -9 PID` pour les terminer. Utilisez `pgrep` ou `ps aux | grep` pour trouver les identifiants de processus.

**Q4 : Quels sont les principaux opérateurs de redirection d'E/S ?**  
A4 : Les opérateurs clés comprennent :  
- `>` - écraser un fichier  
- `>>` - ajouter à un fichier  
- `2>` - erreurs de redirection  
- `&>` - combiner stdout et stderr  
- `|` - sortie de tuyau entre les commandes

**Q5 : Comment puis-je simplifier les tâches répétitives dans Bash ?**  
A5 : Utilisez des alias (par exemple, `alias ll='ls -alh'`) et des raccourcis d'historique du shell comme `!!` pour répéter la dernière commande, `!$` pour le dernier argument ou `Ctrl+R` pour rechercher l'historique des commandes.

**Q6 : Quels sont les raccourcis clavier utiles pour éditer les commandes dans Bash ?**  
A6 : Les raccourcis courants incluent :  
- `Ctrl+A` / `Ctrl+E` - aller au début/à la fin de la ligne  
- `Ctrl+W` / `Alt+D` - supprimer des mots  
- `Ctrl+T` - échanger des caractères  
- `Tab` - commandes de saisie semi-automatique ou noms de fichiers

**Q7 : Comment effectuer une manipulation de chaîne ou une arithmétique dans Bash ?**  
A7 : Utilisez l'extension de paramètres `${var//search/replace}` pour les chaînes, `${file##*/}` pour extraire les noms de fichiers et `$((expression))` pour les calculs arithmétiques.

**Q8 : Bash peut-il gérer des boucles et des conditions pour l’automatisation ?**  
A8 : Oui. Utilisez les constructions `for`, `while`, `if`, `case` et `function` pour écrire des scripts qui automatisent efficacement les tâches.

## Source

- [Aide-mémoire Bash : commandes, scripts et conseils sur les terminaux pour Linux](https://serverspace.io/fr/support/help/bash-cheat-sheet/)
