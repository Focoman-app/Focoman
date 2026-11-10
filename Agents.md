# Focoman Agent System Directives

This repository operates under the strict governance of **[Agents.md](Agents.md)**.

All AI coding agents interacting with the Focoman codebase MUST read and strictly adhere to **[Agents.md](Agents.md)** and **[Index.md](docs/Index.md)**.

## Mandatory Workflow

For EVERY user engineering request, agents MUST execute the 4 mandatory phases:

```text
User Request
     ↓
Program Manager (Task Decomposition & Implementation Plan)
     ↓
USER APPROVAL GATE (Explicit approval required before coding)
     ↓
Solution Architect (Technical Blueprint / Solution Guide)
     ↓
Developer (Focused Implementation)
     ↓
Testing (Truthful Verification & Real Data Integrity)
```

## Non-Negotiable Core Rules

1. **Plan Before Execute & Explicit User Approval**: Do NOT implement code until an implementation plan has been explicitly approved by the user.
2. **Mandatory 4-Phase Chain**: Developer must NOT bypass Program Manager or Solution Architect stages.
3. **Source of Truth & Documentation Map**: Always consult `docs/Index.md` first to locate authoritative project specifications.
4. **Repository Awareness**: Verify all files, functions, APIs, models, and schemas before assuming existence.
5. **No Hallucination**: Never fabricate requirements, endpoints, schemas, or test results.
6. **No Fake Data / No Silent Fallback**: Mock, dummy, placeholder, or hardcoded substitutes for real data are strictly prohibited. Surface truthful error/unavailable states.
7. **Security & Permissions**: Preserve authorization boundaries. Do not bypass security to simplify implementation.
8. **No Automated Browser Subagents or Browser UAT**: NEVER open browser windows, spawn browser subagents, or execute automated browser UAT. All testing and browser validation is performed directly by the user. Agents must focus strictly on coding and the specific tasks assigned without spawning browser subagents or wasting tokens on visual validation.

Refer to **[Agents.md](Agents.md)** for detailed role prompts, protocols, and definitions of done.
