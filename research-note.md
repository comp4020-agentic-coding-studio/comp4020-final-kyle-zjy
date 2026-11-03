# Research note: an agent's work is only as good as the check it has to pass

## The claim

Good agentic software development rests less on prompting and more on
**verification that does not depend on the developer's sense of how it is
going**. The evidence suggests that, with agents involved, that sense is the
least reliable instrument in the room. Good practice therefore moves
judgement out of the head and into things that run: tests, type checks,
replays and CI gates. Prompts and instruction files then become a way to
point the agent at those checks, not a substitute for them.

## Felt productivity and measured productivity disagree

The headline productivity results point in opposite directions. In a
controlled task, developers with GitHub Copilot finished a JavaScript HTTP
server 55.8% faster than a control group (Peng et al., 2023). In a randomised
trial on 246 real tasks in mature open-source repositories they knew well,
experienced developers using early-2025 tools took 19% *longer* (Becker et
al., 2025).

These results can both be true. The first task was small, fresh and fully
specified. The second involved large codebases with implicit standards, where
generated code has to be reviewed, corrected and fitted. The more telling
detail is in the second study. Developers predicted a 24% speed-up before
starting, and still believed they had gained about 20% afterwards. Their
estimate was wrong in direction, not just size, and it stayed wrong after
the experience.

Security shows the same gap. In Perry et al.'s user study (CCS 2023),
participants with an AI assistant wrote significantly less secure code *and*
were more likely to believe it was secure. The participants who did better
were the ones who distrusted the assistant and kept reworking their prompts.
Neither study is about agents in the narrow sense. But if a single-suggestion
assistant already separates confidence from quality, an agent making dozens
of unreviewed edits per turn can only widen that gap.

## What the practitioners converged on

Practitioner guidance arrives at the same place, from experience rather than
experiment. Anthropic's engineering guide says agents must "gain 'ground
truth' from the environment at each step" and recommends "extensive testing
in sandboxed environments" (Erik S. & Zhang, 2024). The Claude Code best
practices go further. They split instructions into non-deterministic ones
(prompts, `CLAUDE.md`), which the model may weigh and set aside, and
deterministic ones (tests, typecheck, hooks, CI), which the harness enforces
every time. They warn that without a check to run, "'looks done' is all it has
to go on", and they tell developers to ask for evidence, because "'All tests
pass' on its own tells you very little" (Anthropic, 2026). Simon Willison puts
it as a professional duty: "the one thing you absolutely cannot outsource to
the machine is testing that the code actually works" (Willison, 2025).

The research community already evaluates agents this way. SWE-bench scores a
model only on whether its patch makes the issue's hidden tests pass
(Jimenez et al., ICLR 2024). That says something: the field trusts execution
for agents and still lets developers grade their own agent-assisted work by
feel.

## The strongest objection

The obvious objection is that verification is itself expensive, and that
writing the tests may be exactly the slow part Becker et al. measured. An
agent can also write tests that pass trivially, so moving judgement into
tests could just move the gap.

Both points are fair, and they narrow the claim without overturning it. A
test is not valuable because it exists. It is valuable because it **can
fail**. That argues for fewer, risk-weighted checks, each shown to fail
without its fix (by reverting the fix, or by mutation), not for maximum
coverage. It also argues for keeping the human on the part an agent can't
self-grade: deciding *what* must be true. The agent can write the check; the
person decides that "a player never receives another player's secret" is the
property worth checking. Perry et al.'s more sceptical participants show this
division working at small scale.

## Where this leaves the field

The near future of agentic practice is less about better prompts than about
better oracles. The skills that compound are specifying properties, building
cheap realistic checks, and treating an agent's report of success as a claim
to verify. Prompts and instruction files matter as routes to those checks.
Where an instruction cannot have exceptions, it belongs in the harness, not in
the prose.

## References

- Anthropic (2026). *Best practices for Claude Code*. https://code.claude.com/docs/en/best-practices
- Becker, J., Rush, N., Barnes, E., & Rein, D. (2025). *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity*. arXiv:2507.09089.
- Jimenez, C. E., Yang, J., Wettig, A., Yao, S., Pei, K., Press, O., & Narasimhan, K. (2024). *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?* ICLR 2024. arXiv:2310.06770.
- Peng, S., Kalliamvakou, E., Cihon, P., & Demirer, M. (2023). *The Impact of AI on Developer Productivity: Evidence from GitHub Copilot*. arXiv:2302.06590.
- Perry, N., Srivastava, M., Kumar, D., & Boneh, D. (2023). *Do Users Write More Insecure Code with AI Assistants?* Proc. ACM CCS 2023, 2785–2799.
- Erik S., & Zhang, B. (2024, December 19). *Building effective agents*. Anthropic Engineering. https://www.anthropic.com/engineering/building-effective-agents
- Willison, S. (2025, March 11). *Here's how I use LLMs to help me write code*. https://simonwillison.net/2025/Mar/11/using-llms-for-code/
