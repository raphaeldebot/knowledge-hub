---
title: "Configuration de Text-to-Speech pour Claude Code"
topic: "development"
level: "beginner"
tags: ["cout", "agent", "claude", "speech", "text-to-speech"]
source_type: "web_saved"
source_id: "https://dev.to/souliane/text-to-speech-for-claude-code-hear-what-the-agent-is-doing-3mom"
confidence: "medium"
status: "draft"
updated: "2026-06-19"
---

# Cout agent claude speech to speech

## Configuration de Text-to-Speech pour Claude Code

### Utilisation des hooks

Claude Code permet d'ajouter des hooks qui exécutent des commandes shell lors de certains événements. Les deux hooks utiles pour le Text-to-Speech sont :

- **Notification** : déclenché lorsqu'une attention est nécessaire (ex. : un message de permission, un rappel d'inactivité).
- **Stop** : déclenché lorsque l'agent a terminé sa réponse.

### Hook Notification

Pour lire à voix haute les messages de notification, ajoutez le hook suivant dans votre fichier de configuration `~/.claude/settings.json` :

```json
{
  "hooks": {
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.message // empty' | say"
          }
        ]
      }
    ]
  }
}
```

- **macOS** : Utilisez `say`.
- **Linux** : Utilisez `spd-say -e` ou `espeak-ng`.
- **Windows** : Utilisez la commande PowerShell suivante :

```json
"command": "jq -r '.message // empty' | powershell -Command \" Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak([Console]::In.ReadToEnd()) \" "
```

### Hook Stop

Pour lire à voix haute la réponse de l'agent, ajoutez le hook suivant dans votre fichier de configuration `~/.claude/settings.json` :

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "jq -rs 'map(select(.type== \" assistant \" )) | last | .message.content[]? | select(.type== \" text \" ) | .text' \" $(jq -r .transcript_path) \" 2>/dev/null | head -c 600 | say"
          }
        ]
      }
    ]
  }
}
```

- **Limitation de la longueur** : `head -c 600` limite la longueur du texte lu à 600 octets.
- **Suppression du markdown** : Si nécessaire, ajoutez une commande pour supprimer les éléments de markdown.
- **Stabilité** : Le format du transcript n'est pas une API stable. Si Claude Code change le format, le filtre `jq` pourrait ne plus fonctionner.

### Configuration avancée avec teatree

Si vous utilisez le projet `teatree`, vous pouvez configurer le Text-to-Speech via le fichier de configuration `[teatree.speak]` :

```ini
[teatree.speak]
local = "dm" # "dm" | "all" | "off"
slack = true # attacher un fichier audio à chaque message DM
```

- **local** : Contrôle les haut-parleurs locaux. `dm` lit uniquement les messages DM, `all` lit toutes les réponses de l'agent, `off` désactive le son.
- **slack** : Active l'envoi d'un fichier audio dans chaque message DM. Requiert les permissions de téléchargement de fichiers du bot.

### Notes importantes

- Le hook `Notification` est plus fiable et simple à utiliser.
- Le hook `Stop` peut être utile, mais il dépend du format du transcript, qui n'est pas stable.
- Le texte lu à voix haute est limité à 600 octets pour éviter les longs messages.
- Le texte lu peut inclure du markdown, ce qui peut être gênant. Une suppression du markdown est recommandée pour une utilisation réelle.

## Source

- [Text-to-Speech for Claude Code — Hear What the Agent Is Doing - DEV Community](https://dev.to/souliane/text-to-speech-for-claude-code-hear-what-the-agent-is-doing-3mom)
