# StatusTag

A 20px mono uppercase tag that states the status of a fact, with an optional 6px pulse for a live state.

| Variant | Token | Mark | When |
| --- | --- | --- | --- |
| default | `label` on `border` | none | promoted evidence: the normal state carries no hue |
| `--candidate` | `candidate` dashed edge | the word CANDIDATE | machine layer, not promoted |
| `--added` | `added` | `+` | an addition on the review surface |
| `--dissent` | `dissent` | `!` | agents disagree |
| `--figure` | `figure` fill, `on-figure` text | none | the one fact the screen is about (SANCTIONED) |

- A hue is never the only mark: each status also has a word or a sign.
- The pulse (`gab-pulse`) sits before a `caption` label. It does not animate on working screens.
