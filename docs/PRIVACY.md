# ChainShield AI Privacy Boundary

Customer source code is processed to generate analysis artifacts, findings, evidence, and reports for the owning workspace. It is not used for model training by this application. AI calls are server-side only and receive only the finding, source ranges, and evidence required for the requested explanation.

Private keys, seed phrases, API keys, and similar secret material must never be uploaded. The API rejects common secret markers, but this is a defense-in-depth control rather than a complete secret scanner. Customers should scan and redact archives before upload.

Transport is HTTPS in hosted environments. Storage and database encryption at rest are deployment responsibilities of the selected managed services. Source deletion should remove the database reference and make the object key unreachable; a production retention job must additionally delete underlying objects according to the configured retention policy.

Access is scoped to workspace membership and recorded in audit events for scan and AI-analysis actions. Report hashes and optional chain anchors contain hashes only; source code remains off-chain.

A production privacy review must set and publish retention periods, deletion SLAs, subprocessors, regional-processing choices, and an explicit customer opt-in if any future model-training program is introduced.
