.DEFAULT_GOAL := help

pico-remount:  ## Remount the CIRCUITPY drive with noasync on macOS Sonoma
	@disky=$$(df | awk '/CIRCUITPY/ {print $$1}'); \
	if [ -z "$$disky" ]; then \
		echo "CIRCUITPY is not mounted"; \
		exit 1; \
	fi; \
	sudo umount /Volumes/CIRCUITPY; \
	sudo mkdir -p /Volumes/CIRCUITPY; \
	sleep 2; \
	sudo mount -v -o noasync -t msdos "$$disky" /Volumes/CIRCUITPY

pico-sync:  ## Sync the CircuitPython code onto the pico
	@COPYFILE_DISABLE=1 cp -R -X pico/* $$(mount | grep CIRCUITPY | cut -d' ' -f 3)

webmixer:  ## Start the web-based sound mixer
	@sleep 2 && open http://localhost:8000&
	@cd pico_mixer_web && poetry run flask run --port 8000 --reload

install:  ## Install python dependencies
	poetry install

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
