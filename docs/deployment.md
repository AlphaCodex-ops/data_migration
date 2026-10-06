# Deployment

## Local use

The MVP is designed to run on one trusted user's machine. Bind the API to localhost and keep `LAKEHOUSE_DATA_DIR` on a local disk with sufficient free space. Back up that directory according to the importance and sensitivity of the uploaded source data. The application has no automatic retention or deletion policy.

## Hosted use is not supported yet

Do not expose the current API to the public internet or treat it as a multi-user service. Before hosted deployment, implement and review at least:

- Authentication and authorization for every API operation.
- Per-user or per-tenant storage isolation and access control.
- Upload quotas, rate limits, request timeouts, and resource limits.
- CSRF/CORS policy appropriate to the deployment origin and cookie/token model.
- A managed object-storage backend, lifecycle/retention policy, and backup/restore process.
- Secret management, TLS termination, audit logging, monitoring, and incident response.
- Malware/content scanning and privacy review appropriate to the files accepted.

The local filesystem path in API responses must also be replaced by a stable logical identifier or authorized download URL before hosting.