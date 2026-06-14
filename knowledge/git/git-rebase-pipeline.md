---
title: "Git rebase explained for beginners official documentation"
topic: "git"
level: "beginner"
tags: []
source_type: "research_note"
source_id: "data/raw/research/git-rebase-explained-for-beginners-official-documentation/extracted-facts.json"
confidence: "medium"
status: "draft"
updated: ""
---

# Git rebase explained for beginners official documentation

## Résumé et concepts

- You can do this _(source-1, fact-1)_
- If you _(source-1, fact-2)_
- If there is a merge conflict during this process, git rebase will stop at the _(source-1, fact-3)_
- You can use git diff to find the markers (<<<<<<) _(source-1, fact-4)_
- You can mark the conflict as _(source-1, fact-5)_
- After resolving all of the conflicts, _(source-1, fact-6)_
- Stop the git rebase and return your branch to its original state with _(source-1, fact-7)_
- Skip the commit that caused the merge conflict with _(source-1, fact-8)_

## Commandes

```bash
Git - git-rebase Documentation
git rebase [-i | --interactive] [<options>] [--exec <cmd>]
git rebase [-i | --interactive] [<options>] [--exec <cmd>] [--onto <newbase>]
git rebase (--continue|--skip|--abort|--quit|--edit-todo|--show-current-patch
git rebase --continue
git rebase --abort
git rebase --skip
git checkout --detach <upstream>
git cherry-pick <commit> for each commit
git rebase --onto master next topic
git rebase --onto master topicA topicB
git rebase --onto topicA~5 topicA~3 topicA
git show REBASE_HEAD
git rebase --keep-base <upstream> <branch> is equivalent to
git rebase --reapply-cherry-picks --no-fork-point --onto <upstream>
```

- Provenance : _(source-1, fact-9)_
- Provenance : _(source-1, fact-10)_
- Provenance : _(source-1, fact-11)_
- Provenance : _(source-1, fact-12)_
- Provenance : _(source-1, fact-13)_
- Provenance : _(source-1, fact-14)_
- Provenance : _(source-1, fact-15)_
- Provenance : _(source-1, fact-16)_
- Provenance : _(source-1, fact-17)_
- Provenance : _(source-1, fact-18)_
- Provenance : _(source-1, fact-19)_
- Provenance : _(source-1, fact-20)_
- Provenance : _(source-1, fact-21)_
- Provenance : _(source-1, fact-22)_
- Provenance : _(source-1, fact-23)_

## Avertissements d’extraction

- Des faits exacts ont été complétés par les règles locales du profil.

## Sources

- [Git - git-rebase Documentation](https://git-scm.com/docs/git-rebase) — `data/raw/research/git-rebase-explained-for-beginners-official-documentation/fetched/git-scm-com-docs-git-rebase.md` (source-1)
