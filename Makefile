# Optional convenience aliases; see docs/testing.md for direct commands.
.DEFAULT_GOAL := help
.PHONY: help test test-frontend test-backend test-docker build test-desktop test-e2e test-security test-integration test-all audit
help test test-frontend test-backend test-docker build test-desktop test-e2e test-security test-integration test-all audit:
	bash scripts/quality/check.sh $@
