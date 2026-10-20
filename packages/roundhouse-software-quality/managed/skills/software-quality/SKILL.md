---
name: quality-attributes
description: Use when a task involves performance, reliability, scalability, observability, compatibility, privacy, localization, or maintainability requirements. Pushes vague goals toward observable and measurable requirements.
---

# Quality Attributes

## Expert stance

Quality attributes are non-functional requirements that determine how well the
system performs its functions. Vague quality goals ("fast", "reliable",
"scalable") are not requirements. Push every quality goal toward an observable,
measurable, testable statement.

## Quality attribute catalog

### Performance

- **Latency:** Maximum acceptable response time (e.g., p95 < 200ms).
- **Throughput:** Maximum acceptable requests per second.
- **Resource usage:** CPU, memory, disk, network bounds.
- **Startup time:** Time to first useful response.

### Reliability

- **Availability:** Percentage of time the system is operational (e.g., 99.9%).
- **Mean time to recovery (MTTR):** How quickly the system recovers from
  failure.
- **Mean time between failures (MTBF):** How often failures occur.
- **Data durability:** Probability of data loss (e.g., six nines).

### Scalability

- **Horizontal scaling:** Can the system handle more load by adding nodes?
- **Vertical scaling:** Can the system handle more load on a single node?
- **Data scaling:** Can the system handle more data?
- **Scaling trigger:** At what load does scaling occur?

### Observability

- **Logging:** What is logged, at what level, in what format?
- **Metrics:** What is measured, at what granularity?
- **Tracing:** Can requests be traced across components?
- **Alerting:** What conditions trigger alerts?

### Compatibility

- **Backward compatibility:** Can old clients work with new servers?
- **Forward compatibility:** Can new clients work with old servers?
- **Browser compatibility:** Which browsers and versions are supported?
- **Device compatibility:** Which devices and screen sizes are supported?

### Privacy

- **Data minimization:** Is only necessary data collected?
- **Data retention:** How long is data kept?
- **Data access:** Who can access what data?
- **Data portability:** Can users export their data?

### Localization

- **Language support:** Which languages are supported?
- **Locale handling:** How are dates, times, numbers, currencies formatted?
- **Text direction:** Is right-to-left text supported?
- **Character encoding:** Is UTF-8 used throughout?

### Maintainability

- **Modularity:** Are concerns separated?
- **Testability:** Can the system be tested easily?
- **Debuggability:** Can problems be diagnosed quickly?
- **Modifiability:** Can the system be changed without breaking other parts?

## From vague to measurable

Transform vague goals into measurable requirements:

| Vague goal | Measurable requirement |
| --- | --- |
| "Fast" | p95 response time < 200ms for API calls |
| "Reliable" | 99.9% availability measured monthly |
| "Scalable" | Handle 10x current load without code changes |
| "Secure" | No critical vulnerabilities in dependency scan |
| "Maintainable" | Change a module without modifying more than 2 others |

## Quality attribute scenarios

Express quality attributes as scenarios:

- **Stimulus:** What event triggers the quality concern?
- **Source:** Where does the stimulus come from?
- **Environment:** Under what conditions does this occur?
- **Artifact:** What part of the system is affected?
- **Response:** How should the system respond?
- **Response measure:** How is the response measured?

Example:

- **Stimulus:** User requests a page.
- **Source:** External user.
- **Environment:** Normal operation, 1000 concurrent users.
- **Artifact:** Web server.
- **Response:** Return the page.
- **Response measure:** p95 latency < 200ms.
