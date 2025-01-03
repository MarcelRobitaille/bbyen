# Change Log

## [3.0.2] 2025-01-03

### Fixes
- Fix writing headers after sending response in authentication server.

## [3.0.1] 2024-12-31

### Fixes
- Fix regression that the process would exit when the email quota is up (#23)

## [3.0.0] 2024-11-18

### Breaking changes
- Increase the minimum supported node version from 14 to 16
  This is the reason for the major release. However, the previous version was not
  really compatible with node 14. It was a mistake to list compatibility.

### New features
- Do not use YouTube API to get whitelisted subscriptions (#19)
- Do not permanently delete subscriptions. This shows you the channel name in
  the database if the channel is deleted.

### Maintenance
- Add simple tests (currently only config) that run for all supported node versions
