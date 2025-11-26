QUAY_NAMESPACE ?= ${GO_PACKAGE_ORG_NAME}
TARGET_REGISTRY := quay.io
IMAGE_TAG ?= ${GIT_COMMIT_ID_SHORT}
REPOSITORY_NAME ?= $(shell basename $$PWD)
IMAGE ?= ${TARGET_REGISTRY}/${QUAY_NAMESPACE}/${REPOSITORY_NAME}:${IMAGE_TAG}
QUAY_USERNAME ?= ${QUAY_NAMESPACE}
IMAGE_PLATFORM ?= linux/amd64

.PHONY: podman-push
podman-push:
	rm -rf plugins/sandbox/dist-dynamic && \
	rm -rf red-hat-developer-hub-backstage-plugin-sandbox && \
	yarn install && \
	npx @janus-idp/cli@3.3.1 package package-dynamic-plugins \
	  --tag $(IMAGE) \
	  --platform $(IMAGE_PLATFORM)
	podman push $(IMAGE)
