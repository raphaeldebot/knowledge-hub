---
title: "Checklist d'installation d'Ollama sur Windows"
topic: "automation"
level: "beginner"
tags: ["ollama", "windows", "powershell", "ia-locale", "installation"]
source_type: "official_doc"
source_id: "official-ollama-windows-install"
confidence: "high"
status: "draft"
updated: "2026-06-09"
---

# Checklist d'installation d'Ollama sur Windows

## Commandes rapides - Installation avec modèles sur D:

Cette section est le chemin rapide pour installer Ollama sur Windows en ligne de commande et stocker les modèles dans `D:\OllamaModels`.

L'ordre est important : il faut définir `OLLAMA_MODELS` avant de télécharger le premier modèle, sinon Ollama risque d'utiliser l'emplacement par défaut dans le profil utilisateur.

```powershell
# 1. Vérifier que le disque D: existe et voir l'espace disponible
Get-PSDrive D

# 2. Créer le dossier où seront stockés les modèles Ollama
New-Item -ItemType Directory -Force -Path "D:\OllamaModels"

# 3. Définir l'emplacement des modèles pour la session PowerShell actuelle
$env:OLLAMA_MODELS = "D:\OllamaModels"

# 4. Définir l'emplacement des modèles pour l'utilisateur Windows
[Environment]::SetEnvironmentVariable("OLLAMA_MODELS", "D:\OllamaModels", "User")

# 5. Vérifier la variable dans la session actuelle
echo $env:OLLAMA_MODELS

# 6. Vérifier la variable enregistrée pour l'utilisateur
[Environment]::GetEnvironmentVariable("OLLAMA_MODELS", "User")

# 7. Installer Ollama depuis la commande officielle Windows
irm https://ollama.com/install.ps1 | iex

# 8. Vérifier qu'Ollama est installé
ollama --version

# 9. Vérifier les modèles déjà installés
ollama list

# 10. Télécharger et lancer un premier modèle léger
ollama run llama3.2:3b

# 11. Tester l'API locale Ollama
Invoke-RestMethod http://localhost:11434/api/tags

# 12. Vérifier que des fichiers sont présents dans D:\OllamaModels
Get-ChildItem -Path "D:\OllamaModels" -Recurse -Force | Select-Object -First 20
```

## Si une commande ne fonctionne pas

- Si `ollama --version` n'est pas reconnu, fermer PowerShell et le rouvrir.
- Si l'API locale ne répond pas, vérifier qu'Ollama est lancé.
- Si les modèles ne vont pas dans `D:\OllamaModels`, vérifier `echo $env:OLLAMA_MODELS` avant de lancer `ollama run`.
- Si Ollama a déjà téléchargé un modèle dans l'ancien dossier, ne pas déplacer les fichiers manuellement sans vérifier la documentation.
- Si le disque `D:` n'existe pas, ne pas continuer avec ces commandes.

## Ce que ces commandes font

- `Get-PSDrive D` vérifie le disque D:.
- `New-Item` crée le dossier des modèles.
- `$env:OLLAMA_MODELS` configure la session actuelle.
- `SetEnvironmentVariable` configure l'utilisateur Windows pour les futures sessions.
- `irm https://ollama.com/install.ps1 | iex` installe Ollama avec la commande officielle Windows.
- `ollama run llama3.2:3b` télécharge et lance un premier modèle local.
- `Invoke-RestMethod http://localhost:11434/api/tags` vérifie que l'API locale répond.

## Résumé

Cette fiche prépare l'installation locale d'Ollama sur Windows pour Knowledge Hub.

Elle ne signifie pas qu'Ollama est déjà installé. Les commandes présentées ici n'ont pas été exécutées pendant la création de cette fiche.

## Avant l'installation

- Vérifier que la version de Windows est compatible.
- Vérifier l'espace disque disponible pour Ollama et les modèles.
- Fermer les applications inutiles avant le premier test.
- Commencer avec un modèle local de petite taille.
- Consulter la documentation officielle actuelle en cas de différence avec cette checklist.

## Installation alternative avec installeur

Si la ligne de commande pose problème, télécharger l'installateur Windows officiel `OllamaSetup.exe` depuis le site officiel Ollama.

La documentation Windows d'Ollama présente cet installeur comme la méthode la plus simple pour une installation Windows classique.

## Notes importantes

- Ne pas installer de modèle cloud.
- Ne pas utiliser `ollama signin` pour le moment.
- Rester sur des modèles locaux.
- Commencer avec un petit modèle.
- Ne connecter Knowledge Hub à Ollama qu'après avoir vérifié qu'Ollama fonctionne seul.
- Si la commande n'est pas reconnue, fermer et rouvrir PowerShell.
- Si l'API ne répond pas, vérifier qu'Ollama est bien lancé.
- Ne pas transmettre de données privées pendant les premiers tests.
- Vérifier la licence et les besoins matériels d'un modèle avant de l'utiliser.

## Checklist

- [ ] La documentation officielle Windows a été relue.
- [ ] La compatibilité de Windows a été vérifiée.
- [ ] L'espace disque disponible a été vérifié.
- [ ] Ollama a été installé depuis une source officielle.
- [ ] `ollama --version` fonctionne.
- [ ] `ollama list` fonctionne.
- [ ] `llama3.2:3b` a été lancé pour un test simple.
- [ ] L'API locale répond sur `/api/tags`.
- [ ] Aucun modèle cloud ni compte Ollama n'est utilisé.
- [ ] Aucun contenu privé n'a été envoyé pendant les tests.
- [ ] Knowledge Hub reste déconnecté d'Ollama jusqu'à validation des tests.

## À vérifier

- Les prérequis Windows officiels au moment de l'installation.
- L'espace disque et la mémoire disponibles sur la machine.
- Les performances de `llama3.2:3b` sur le matériel utilisé.
- La version d'Ollama installée.
- Le stockage local choisi pour les modèles.

## Sources officielles

- Page de téléchargement Windows : `https://ollama.com/download/windows`
- Documentation Windows : `https://docs.ollama.com/windows`
- Documentation de l'API `/api/tags` : `https://docs.ollama.com/api/tags`
- Fiche du modèle `llama3.2:3b` : `https://ollama.com/library/llama3.2:3b`
- Documentation des modèles cloud : `https://docs.ollama.com/cloud`

## Liens liés

- `knowledge/automation/ollama-local-agent-setup.md`
- `knowledge/automation/web-research-agent-spec.md`
- `knowledge/automation/research-workflow.md`
