## <img src="https://raw.githubusercontent.com/LambdaTest/kane-cli/main/integrations/github-action/kane-cli-pr/assets/kane-mascot.png" width="30" height="23" align="absmiddle" alt=""> kane-cli · gate-keeper

**You asked**
> does this break checkout?

@octocat No — checkout still works: all 4 impacted tests pass.

![4 impacted](https://img.shields.io/badge/impacted-4-0969da?style=for-the-badge) ![0 new](https://img.shields.io/badge/new%20in%20PR-0-6e7781?style=for-the-badge) ![4 passing](https://img.shields.io/badge/passing-4-1a7f37?style=for-the-badge) ![policy passed](https://img.shields.io/badge/policy-passed-1a7f37?style=for-the-badge)

<details>
<summary>🧪 <b>Tests</b> — 4 ran · 0 failed</summary>
<br>

| | Test | Result |
|:---:|---|---|
| ✅ | **Apply SPRING2026 without changing free shipping** | passed in 41 s |
| ✅ | **Apply SPRING2026 without changing paid shipping** | passed in 41 s |
| ✅ | **Checkout below the threshold keeps $5 shipping** | passed in 41 s |
| ✅ | **Checkout at the $50 threshold keeps free shipping** | passed in 41 s |
</details>

<details>
<summary>🔎 <b>Why these tests</b> — the change touches 2 requirements</summary>
<br>

This PR changes `src/cart/pricing.js`, `public/cart.html`. kane matched that change to the requirements each test verifies:

- **🎯 Apply a promo code to a cart** — 🟩🟩 0 of 2 failing
  - Apply SPRING2026 without changing free shipping
  - Apply SPRING2026 without changing paid shipping
- **🎯 Place an order** — 🟩🟩 0 of 2 failing
  - Checkout below the threshold keeps $5 shipping
  - Checkout at the $50 threshold keeps free shipping

All 4 tests already exist on `main`, so they count as impacted (none are new in this PR).
</details>

### 🧾 Evidence
[![Open the evidence pack](https://img.shields.io/badge/Open%20the%20evidence%20pack-%E2%86%97-0969da?style=for-the-badge)](https://evidence.lambdatest.com/?pack=gh-artifact:octo-org/shop/12704118114)
Screenshots, network and console for every step of all 4 tests · kept 30 days

### 🛡️ Policy · `checkout-pr` — ✅ passed
**All blocking gates passed**

| | Gate | Required | This run |
|:---:|---|:---:|:---:|
| ✅ | All tests pass | 0 failed | 0 failed |
| ✅ | Checkout tests green | 100 % | 100 % |
| ✅ | Every test has a check | 0 without | 0 without |
| ✅ | No healed tests *(warning)* | 0 | 0 |

<details>
<summary>📜 <b>View the policy</b> — <code>.github/kane/checkout-policy.yaml</code> on <code>main</code></summary>
<br>

```yaml
policy: checkout-pr
gates:
  - { id: all-pass, metric: totals.failed, equals: 0, severity: blocking }
  - { id: no-heals, metric: metrics.heal.healed_tests, max: 0, severity: warning }
```

[Open the file](https://github.com/octo-org/shop/blob/main/.github/kane/checkout-policy.yaml)
</details>

<sub>kane-cli · ran on `e9e1bf7` in 2 m 05 s · [run log](https://github.com/octo-org/shop/actions/runs/1)</sub>
