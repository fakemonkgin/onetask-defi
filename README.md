# OneTask DeFi

A consumer-facing multi-agent DeFi task assistant powered by x402 and ERC-8004.

> Status: Early-stage learning project. Local development and testnet assets only.

## Goal
Turn a user's natural-language DeFi intent into a verified execution plan assembled by specialized AI agents.

## Planned Flow
1. A user describes a DeFi task.
2. An orchestrator discovers agents through an ERC-8004-compatible registry.
3. The orchestrator pays selected services through x402.
4. Agents return signed risk, route, and simulation evidence.
5. The user reviews and authorizes a structured execution plan.
6. Smart contracts enforce policy before interacting with ERC-4626 vaults.

## Planned Repository Structure
```text
apps/
├── web/
└── orchestrator/

services/
├── risk-agent/
├── route-agent/
└── simulation-agent/

packages/
├── contracts/
└── shared/

docs/
```

## Security Principles
- Use local networks and testnet assets during development.
- Never store a user's private key or seed phrase.
- Never allow an LLM to directly execute arbitrary calldata.
- Bind every agent response to a specific task hash and expiration time.
- Require user authorization before the final onchain execution.

## Current Progress
- [x] Initialize the Git repository.
- [x] Configure the npm workspace root.
- [x] Add the root `.gitignore`.
- [ ] Create the Next.js application.
- [ ] Create the Foundry project.
- [ ] Implement the first ERC-4626 mock vault.

## License
MIT
