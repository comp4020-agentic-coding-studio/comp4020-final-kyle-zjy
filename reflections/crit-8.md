# Crit 8 Reflection

One thing that changed during this project was how I thought about using an AI coding agent. At first I treated it mainly as a faster implementer: I would describe a large feature and expect the agent to work through it. That became hard to evaluate once many decisions were being made at the same time. The project was already planned in phases, but for a while I let the agent run through them unattended. I changed the workflow by making the agent stop, report, and wait for approval after each phase. I also moved important rules into `CLAUDE.md` so that they survived context changes.

The most useful lesson was that the harness should contain lessons from failures, not only initial instructions. For example, UI problems led to rules about measuring individual elements, because page-level width checks hid clipped content, and about looking at screenshots instead of trusting the DOM. Later, balancing work led to a rule that tuning changes should be justified with simulation data. This made the agent more consistent over time.

If I did the project again, I would establish the stop-and-review workflow and harness earlier instead of discovering them while building. I now want to work as a developer who treats AI output as something to structure and verify, rather than something to accept because it was produced quickly.
