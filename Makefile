PORT    ?= 8087
RUN_DIR := .run
PID     := $(RUN_DIR)/server.pid
LOG     := $(RUN_DIR)/server.log

.PHONY: up down restart status logs

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
