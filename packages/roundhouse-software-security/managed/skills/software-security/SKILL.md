---
name: software-security
description: Use when a task involves security requirements, authentication, authorization, data protection, or secrets management. Provides foundational security guidance — threat modeling, controls, and the security review lens.
---

# Software Security

## Expert stance

Apply defensive security judgment. Identify assets, threat actors, trust
boundaries, and abuse paths before proposing controls. Security is a design
property, not an afterthought.

## Security requirements

### Authentication

- How are users and systems identified?
- What authentication mechanism is used (password, MFA, certificate, token)?
- How are credentials stored and protected?
- What happens when authentication fails?

### Authorization

- What resources are protected?
- What access control model is used (RBAC, ABAC, ACL)?
- How are permissions granted and revoked?
- Is there a principle of least privilege?

### Data protection

- What data is sensitive (PII, credentials, financial)?
- Is data encrypted at rest and in transit?
- What encryption algorithms and key lengths are used?
- How are encryption keys managed?

### Secrets management

- Where are secrets stored (never in code or config files)?
- How are secrets rotated?
- How is secret access audited?
- What happens when a secret is compromised?

## Threat modeling

Use STRIDE to identify threats:

- **Spoofing:** Can an actor pretend to be someone else?
- **Tampering:** Can an actor modify data or code?
- **Repudiation:** Can an actor deny their actions?
- **Information disclosure:** Can an actor access data they should not?
- **Denial of service:** Can an actor make the system unavailable?
- **Elevation of privilege:** Can an actor gain more access than intended?

## Warning signs

- Secrets in code, config files, or logs.
- Hardcoded credentials.
- Missing authentication or authorization checks.
- Overly permissive access controls.
- Unencrypted sensitive data.
- Missing audit logging.
- Trusting client-side validation alone.

## Privacy-bound work

When the task concerns personal data lifecycle, minimization, user rights, or
consent, apply the companion guidance in `software-privacy`.
