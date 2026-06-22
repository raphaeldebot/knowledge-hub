---
title: "Comment installer wsl sur windows"
topic: "development"
level: "beginner"
tags: ["installer", "wsl", "windows", "guide", "installation"]
source_type: "web_saved"
source_id: "https://www.youstable.com/fr/blog/Comment-installer-WSL-sous-Windows-/"
confidence: "medium"
status: "draft"
updated: "2026-06-18"
---

# Comment installer wsl sur windows

## Comment installer WSL sur Windows

### Étapes pour installer WSL

#### Étape 1 : Ouvrez PowerShell ou le Terminal Windows en tant qu’administrateur

#### Étape 2 : Installer WSL à l’aide d’une seule commande

```powershell
wsl --install
```

#### Étape 3 : Terminer l’installation d’Ubuntu

- Une fois l’installation de WSL terminée, le système vous demandera de choisir une distribution Linux. Sélectionnez **Ubuntu** ou une autre distribution de votre choix.

#### Étape 4 : Vérifier que WSL est correctement installé

```powershell
wsl --list --verbose
```

### Comment installer Ubuntu sur WSL

#### Étape 1 : Installer Ubuntu sur WSL

- Utilisez le Microsoft Store pour installer **Ubuntu** ou exécutez la commande suivante dans PowerShell :

```powershell
wsl --install -d Ubuntu
```

#### Étape 2 : Définir Ubuntu comme distribution par défaut

```powershell
wsl --set-default Ubuntu
```

#### Étape 3 : Configuration complète de l’utilisateur Ubuntu

- Lors de la première ouverture d’Ubuntu, vous devrez créer un nom d’utilisateur et un mot de passe.

### Comment installer d'autres distributions Linux sur WSL

#### Étape 1 : Ouvrez PowerShell ou le Terminal Windows en tant qu’administrateur

#### Étape 2 : Installez une distribution Linux (exemple : Debian)

```powershell
wsl --install -d Debian
```

#### Étape 3 : Définir la distribution par défaut (si nécessaire)

```powershell
wsl --set-default Debian
```

### Configuration système requise

- **Windows Version** : Windows 10 version 2004 ou ultérieure (recommandé : Windows 11)
- **Virtualisation activée** : Activez la virtualisation dans le BIOS/UEFI de votre ordinateur et dans les paramètres de Windows (dans le menu **Paramètres > Mise à jour et sécurité > Fonctionnalités Windows > Activer la virtualisation**).

### Commandes utiles

- **Lister les distributions installées** :

```powershell
wsl --list --verbose
```

- **Démarrer une distribution** :

```powershell
wsl -d Ubuntu
```

- **Arrêter une distribution** :

```powershell
wsl --shutdown
```

- **Supprimer une distribution** :

```powershell
wsl --unregister Ubuntu

## Source

- [Comment installer WSL sur Windows en 2026 - Guide d'installation facile](https://www.youstable.com/fr/blog/Comment-installer-WSL-sous-Windows-/)
