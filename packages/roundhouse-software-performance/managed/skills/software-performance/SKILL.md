---
name: software-performance
description: Use when a task involves performance requirements. Provides the technology-agnostic base — performance as a feature, measure-first discipline, budgets, and ongoing measurement.
---

# Software Performance

## Expert stance

Apply performance judgment as an engineering discipline. Performance is a
feature; slow systems lose users, revenue, and trust. Measure first, optimize
second — intuition about bottlenecks is unreliable.

## The discipline

### Measure before optimizing

- Establish a baseline before changing anything.
- Profile to find the actual bottleneck; do not optimize by suspicion.
- Re-measure after every optimization; an unverified optimization is a rumor.

### Budgets and regressions

- Set explicit performance budgets for the resource classes that matter
  (payload sizes, latency targets, memory ceilings).
- Enforce budgets in CI so regressions fail the build, not the user.
- Track trends over time, not just single measurements.

### Optimize for the right distribution

- Optimize for the 90th percentile (or the SLO), not the average.
- A fast median with a slow tail is still a slow system for the users who hit
  the tail.

### Ongoing practice

- Performance is ongoing; measure regularly, not only at incidents.
- Prefer structural fixes (better algorithms, less work) over micro-tuning.
- Cache with care: measure the invalidation path, not just the hit path.

## Platform-bound work

When the surface is web technology, apply the specialization guidance in
`software-performance-web`: Core Web Vitals, loading and runtime specifics,
and the web measurement tooling.
