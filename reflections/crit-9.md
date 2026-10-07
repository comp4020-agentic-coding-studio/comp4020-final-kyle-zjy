# Crit 9 Reflection

The biggest change in my engineering judgement was around testing. Early in the project I wanted almost everything tested repeatedly because I was worried about the size of the system. By the middle of the build, that approach was producing many low-value repetitions. I switched to risk-driven testing: concurrency, hidden information, reconnects, deterministic randomness, skill execution, and win/loss logic received the strongest coverage, while unchanged static data did not need the same expensive checks every phase.

This mattered because several important bugs were not simple rendering mistakes. The server sent each player a field revealing whether their own secret message was true, which defeated the point of the message; two players could both end the same turn; and an exploration penalty accidentally made inactivity a rational strategy. These problems showed me that a passing UI is not evidence that a multiplayer system is correct.

I also learned to value tests that can prove they are meaningful. For important fixes, I had the old broken behaviour restored temporarily to confirm that the new test actually failed. In future projects I want to spend less effort chasing a high test count and more effort identifying which failures would cause the most damage, then designing tests around those risks.
