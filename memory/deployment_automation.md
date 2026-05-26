---
name: deployment_automation
description: Automated deployment workflow triggered on "push" or "deploy" keywords
metadata:
  type: project
---

# Automated Deployment Workflow

## Setup
Configured a `UserPromptSubmit` hook in `.claude/settings.json` that monitors for "push" or "deploy" keywords in user messages.

## What It Does
When you type "push" or "deploy" in any message:
1. Stages all changes: `git add -A`
2. Creates a commit: `git commit -m "deploy: <timestamp>"`
3. Pushes to GitHub: `git push`
4. Deploys API to Railway: `railway up --service api --detach -m "auto-deploy: <timestamp>"`

## How It Works
- **Event**: `UserPromptSubmit` hook in `.claude/settings.json`
- **Trigger**: Message contains "push" or "deploy" (case-insensitive)
- **Timeout**: 120 seconds (allows time for Railway deployment)
- **Safety**: Uses `|| true` to prevent blocking if workflow fails

## When It Activates
✅ "push" — any message containing "push"
✅ "deploy" — any message containing "deploy"
✅ "push and then deploy" — contains both keywords
✅ "PUSH" or "Deploy" — case-insensitive

## Important Notes
- Web app deploys automatically on GitHub push (handled by Railway rules)
- API deployment happens via Railway CLI in the hook
- Must be logged into Railway for this to work: `railway login`
- If Railway session expires, the hook will fail silently

## To Modify
Edit `.claude/settings.json` hook section to change:
- Keywords (currently: "push" or "deploy")
- Commit message format
- Deployment command or flags
