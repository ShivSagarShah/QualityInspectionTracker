---
name: Node 20 native addons
description: Replit runtime behavior to account for when building native Node addons against Node 20.
---

When this workspace's interactive shell was switched to Node 20, pnpm lifecycle scripts for a native addon still compiled it with Node 24. The resulting addon loaded under one runtime but failed under the other.

**Why:** the shell and dependency lifecycle can use different Node binaries, so selecting a Node version alone does not guarantee the native module ABI matches the running service.

**How to apply:** when changing a workflow's Node major version, verify the actual runtime used by both the build hook and the service. Test the native module under the service runtime, and rebuild it with matching Node headers or make the runtime versions consistent.
