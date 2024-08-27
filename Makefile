VERSION ?= 1.0.1.1

clean:
	rm -rf dist

change-version:
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" src/browser-extension/manifest.json


change-package-version:
	sed -i -e "s/\"version\": \".*\"/\"version\": \"$(VERSION)\"/" package.json

build-browser-extension: change-version change-package-version
	pnpm vite build -c vite.config.chromium.ts
	cd dist/browser-extension/chromium && zip -r ../chromium.zip .

build-userscript: change-package-version
	pnpm vite build -c vite.config.userscript.ts

build-popclip-extension:
	rm -f dist/openai-translator.popclipextz
	mkdir -p dist/openai-translator.popclipext
	cp -r clip-extensions/popclip/* dist/openai-translator.popclipext
	cd dist && zip -r openai-translator.popclipextz openai-translator.popclipext && rm -r openai-translator.popclipext

build-snipdo-extension:
	rm -f dist/openai-translator.pbar
	zip -j -r dist/openai-translator.pbar clip-extensions/snipdo/*
