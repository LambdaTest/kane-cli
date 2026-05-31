# Performance Assertions (Web Vitals)

Performance assertions let you verify [Core Web Vitals](https://web.dev/articles/vitals) and other key performance metrics for the current page.

## How Capture Works

Performance data is **navigation-based** — metrics are measured for the most recent page navigation:

- **Automatic measurement**: KaneAI uses the [web-vitals](https://github.com/GoogleChrome/web-vitals) library to capture metrics
- **Per-navigation scope**: Metrics reflect the last full page load. If you navigate to a new page, the metrics reset for that navigation
- **Point-in-time snapshot**: When a performance checkpoint triggers, KaneAI captures the current metrics at that moment

### What This Means for Your Tests

- Performance metrics describe the **last navigation** — if you navigate to Page A then Page B, the metrics reflect Page B
- Place performance assertions **after** the page you want to measure has fully loaded
- Use a wait step if the page needs time to settle before measuring

## Available Metrics

| Metric | What It Measures | Good Threshold | Learn More |
|--------|-----------------|----------------|------------|
| **LCP** | Largest Contentful Paint — when the largest visible element finishes rendering | < 2,500ms | [web.dev/lcp](https://web.dev/articles/lcp) |
| **CLS** | Cumulative Layout Shift — visual stability, how much the page layout shifts | < 0.1 | [web.dev/cls](https://web.dev/articles/cls) |
| **INP** | Interaction to Next Paint — responsiveness to user input | < 200ms | [web.dev/inp](https://web.dev/articles/inp) |
| **FCP** | First Contentful Paint — when the first content appears on screen | < 1,800ms | [web.dev/fcp](https://web.dev/articles/fcp) |
| **TTFB** | Time to First Byte — server response time | < 800ms | [web.dev/ttfb](https://web.dev/articles/ttfb) |

> **Note**: Not all metrics are available for every page. INP requires user interaction to trigger. Some metrics may be `null` if the browser hasn't measured them yet.

## Example Assertions

```
Assert: page LCP is under 2500ms
Assert: CLS is below 0.1
Assert: TTFB is under 800ms
Assert: FCP is less than 1800ms
Assert: page performance meets Core Web Vitals thresholds
```

## Example Extractions

```
Store the page LCP value
Extract all web vitals metrics
Store the TTFB for this page
```

## Example If/Else

```
If LCP is under 2500ms then continue, else report performance issue
```

## Tips

- **Wait for load**: Place a wait step before performance assertions to ensure the page has fully loaded and metrics are available
- **Navigate first**: Metrics are per-navigation — make sure you've navigated to the target page before asserting
- **Not all metrics are instant**: CLS accumulates over time, INP requires interaction. LCP and FCP are typically available after the page visually completes loading
