.PHONY: test build clean help prepare-test run-test

# Variables (peuvent être overridées)
ZIP_DIR ?= out/make/zip
ZIP_PATTERN = $(ZIP_DIR)/**/*.zip
APP_TEST_DIR = app-under-test
REPORT_DIR = playwright-report
TEST_RESULTS_DIR = test-results

# Détecter l'architecture
ARCH := $(shell uname -m)
ifeq ($(ARCH),arm64)
	ARCH_NAME = arm64
else
	ARCH_NAME = x64
endif

help:
	@echo "Commandes disponibles:"
	@echo "  make test          - Build l'app, lance les tests E2E et affiche les rapports"
	@echo "  make build         - Build le ZIP via Electron Forge"
	@echo "  make prepare-test  - Extrait le ZIP et prépare l'app pour les tests"
	@echo "  make run-test      - Lance uniquement les tests Playwright"
	@echo "  make clean         - Nettoie les artifacts de test"
	@echo ""
	@echo "Variables (override avec VAR=value):"
	@echo "  ZIP_DIR            - Répertoire contenant le ZIP (défaut: out/make/zip)"
	@echo "  ZIP_FILE           - Chemin exact vers le ZIP (override le pattern)"
	@echo ""
	@echo "Exemples:"
	@echo "  make prepare-test ZIP_FILE=test-artifacts/Juni-darwin-universal.zip"
	@echo ""
	@echo "Architecture détectée: $(ARCH_NAME)"

build:
	@echo "Build du ZIP via Electron Forge..."
	@yarn make
	@echo "Build terminé"

prepare-test:
	@echo "Préparation de l'app pour les tests..."
	@# Trouver le ZIP (ou utiliser ZIP_FILE si fourni)
	@if [ -n "$(ZIP_FILE)" ]; then \
		ZIP_PATH="$(ZIP_FILE)"; \
	else \
		ZIP_PATH=$$(find $(ZIP_DIR) -name "*.zip" 2>/dev/null | head -n 1); \
	fi; \
	if [ -z "$$ZIP_PATH" ]; then \
		echo "Aucun ZIP trouvé dans $(ZIP_DIR). Lancez 'make build' ou spécifiez ZIP_FILE=..."; \
		exit 1; \
	fi; \
	echo "Extraction du ZIP: $$ZIP_PATH"; \
	rm -rf $(APP_TEST_DIR); \
	mkdir -p $(APP_TEST_DIR); \
	unzip -q "$$ZIP_PATH" -d $(APP_TEST_DIR); \
	echo "Suppression de la quarantaine..."; \
	xattr -dr com.apple.quarantine "$(APP_TEST_DIR)/Kagron.app" 2>/dev/null || true; \
	echo "Vérification de la signature..."; \
	codesign -vvv --deep --strict "$(APP_TEST_DIR)/Kagron.app" 2>&1 || echo "Signature vérification terminée"; \
	echo "App prête dans $(APP_TEST_DIR)/"

run-test:
	@echo "Lancement des tests Playwright..."
	@if [ ! -d "$(APP_TEST_DIR)/Kagron.app" ]; then \
		echo "App non trouvée. Lancez 'make prepare-test' d'abord."; \
		exit 1; \
	fi
	@TEST_ARCH=$(ARCH_NAME) npx playwright test
	@echo ""
	@echo "RAPPORTS DE TEST"
	@echo "=================================================="
	@if [ -f "juni-login-$(ARCH_NAME).png" ]; then \
		echo "Screenshot: $$(pwd)/juni-login-$(ARCH_NAME).png"; \
	fi
	@if [ -d "$(REPORT_DIR)" ]; then \
		echo "Rapport HTML: $$(pwd)/$(REPORT_DIR)/index.html"; \
		echo "   Ouvrir avec: open $(REPORT_DIR)/index.html"; \
	fi
	@if [ -d "$(TEST_RESULTS_DIR)" ]; then \
		echo "Résultats détaillés: $$(pwd)/$(TEST_RESULTS_DIR)"; \
	fi
	@echo "=================================================="

test: build prepare-test run-test
	@echo ""
	@echo "Tests terminés avec succès!"

clean:
	@echo "Nettoyage des artifacts de test..."
	@rm -rf $(APP_TEST_DIR)
	@rm -rf $(REPORT_DIR)
	@rm -rf $(TEST_RESULTS_DIR)
	@rm -f juni-login-*.png
	@# Tuer les processus Juni éventuellement bloqués
	@pkill -9 Juni 2>/dev/null || true
	@echo "Nettoyage terminé"
