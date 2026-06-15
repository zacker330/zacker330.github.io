# Makefile for the showme.codes Hugo blog.
# Requires the *extended* Hugo build (see CLAUDE.md / config.toml min_version).

DATE := $(shell date +%F)

.DEFAULT_GOAL := help

.PHONY: help server serve build clean new-zh new-en

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

server: ## Start the local dev server WITH drafts (new posts are draft:true) -> http://localhost:1313
	hugo server -D

serve: ## Start the local dev server, published content only
	hugo server

build: ## Build the static site into ./public
	hugo

clean: ## Remove the generated ./public directory
	rm -rf public

new-zh: ## Scaffold a Chinese post: make new-zh SLUG=my-post
	@test -n "$(SLUG)" || { echo "usage: make new-zh SLUG=my-post"; exit 1; }
	hugo new content/zh-cn/$(DATE)-$(SLUG).md

new-en: ## Scaffold an English post: make new-en SLUG=my-post
	@test -n "$(SLUG)" || { echo "usage: make new-en SLUG=my-post"; exit 1; }
	hugo new content/en/$(DATE)-$(SLUG).md
