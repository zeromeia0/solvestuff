PORT    ?= 8087
RUN_DIR := .run
PID     := $(RUN_DIR)/server.pid
LOG     := $(RUN_DIR)/server.log

.PHONY: up down restart status logs apk

up:
	@mkdir -p $(RUN_DIR)
	@if [ -f $(PID) ] && kill -0 $$(cat $(PID)) 2>/dev/null; then \
		echo "solvestuff já está a correr (pid $$(cat $(PID))) em http://localhost:$(PORT)"; \
	else \
		nohup node server.js > $(LOG) 2>&1 & echo $$! > $(PID); \
		sleep 1; \
		if kill -0 $$(cat $(PID)) 2>/dev/null; then \
			echo "solvestuff a correr em http://localhost:$(PORT) (pid $$(cat $(PID)))"; \
		else \
			echo "Falhou o arranque:"; cat $(LOG); rm -f $(PID); exit 1; \
		fi \
	fi

down:
	@if [ -f $(PID) ] && kill -0 $$(cat $(PID)) 2>/dev/null; then \
		kill $$(cat $(PID)) && echo "solvestuff parado"; \
	else \
		echo "solvestuff não está a correr"; \
	fi
	@rm -f $(PID)

restart: down up

status:
	@if [ -f $(PID) ] && kill -0 $$(cat $(PID)) 2>/dev/null; then \
		echo "a correr (pid $$(cat $(PID))) em http://localhost:$(PORT)"; \
	else \
		echo "parado"; \
	fi

logs:
	@tail -f $(LOG)

# Android app: builds mobile/dist/solvestuff-<version>-build<n>.apk (see mobile/build.mjs).
# SERVER=https://... make apk  to point the app at another server.
apk:
	@node mobile/build.mjs

# PHP hosting (AeonFree). `make deploy` builds, uploads changed code, and syncs data both ways:
# local-only data changes go up, changes made on the live admin page come down, and if both
# sides changed the same file it stops. Resolve with FORCE=local / FORCE=live make deploy.
.PHONY: site deploy
site:
	@hosting/build.sh
deploy: site
	@hosting/deploy.sh
