# Agent Mesh — GitHub Publish Checklist

## Pre-publish
- [ ] Remove any hardcoded auth tokens/IPs
- [ ] Add example config files (not real secrets)
- [ ] Write README with setup instructions
- [ ] Add SECURITY.md with trust model docs

## Files to include
- relay/message-handler.sh
- relay/start-relay.sh
- relay/agent-mesh-relay.service
- clients/agent-mesh.js (Node.js remote client)
- clients/agent-mesh.sh (bash local client)
- specs/agent-card.json
- specs/message-schema.md
- ROADMAP.md
- DESIGN.md
- SECURITY.md

## After publish
- [ ] Announce in OpenClaw Solutions Discussions
- [ ] Pin to ClawHub if/when ready
