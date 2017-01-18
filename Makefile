BUILD_NUMBER ?= 0
BRANCH ?= unknown-branch

ifeq (, $(shell which chronic))
	CHRONIC=
else
	CHRONIC=chronic
endif

default:
	exit 1

build-remote:
	rsync -aP ./ $(HOST):BeameMatchingServer/
	ssh -A $(HOST) "cd BeameMatchingServer && make build"
	rsync -aP $(HOST):BeameMatchingServer/build/matching-$(BUILD_NUMBER).tar.gz ../system/images/matching/artifacts/


.PHONY: build
build:
	$(CHRONIC) npm install
	#$(CHRONIC) npm shrinkwrap
	mkdir -p build
	$(CHRONIC) rsync -aP --delete --include={'/src/***','/models/***','/migrations/***','/seeders/***','/node_modules/***','/config/***','/package.json','/defaults.js','/constants.js','/index.js'} --exclude='*'   ./ ./build/$(BUILD_NUMBER)/
	jq '.build={buildNumber: $(BUILD_NUMBER), commit:"$(GIT_COMMIT)", branch:"$(GIT_BRANCH)", job:"$(JOB_NAME)"}' build/$(BUILD_NUMBER)/package.json >build/$(BUILD_NUMBER)/package.json.new
	mv build/$(BUILD_NUMBER)/package.json.new build/$(BUILD_NUMBER)/package.json
	rm build/*.tar.gz || true
	tar -C build -czf  ./build/matching-$(BRANCH)-$(BUILD_NUMBER).tar.gz $(BUILD_NUMBER)/
	rm -r ../../System/system/images/matching/artifacts/* || true
	cp ./build/matching-$(BRANCH)-$(BUILD_NUMBER).tar.gz ../../System/system/images/matching/artifacts/