QUAY_NAMESPACE ?= codeready-toolchain
TARGET_REGISTRY := quay.io
IMAGE_TAG ?= ${GIT_COMMIT_ID_SHORT}
# sandbox-rhdh-plugin provisory
IMAGE ?= ${TARGET_REGISTRY}/${QUAY_NAMESPACE}/sandbox-rhdh-plugin:${IMAGE_TAG}
QUAY_USERNAME ?= ${QUAY_NAMESPACE}
IMAGE_PLATFORM ?= linux/amd64

.PHONY: podman-push
podman-push:
	rm -rf plugins/sandbox/dist-dynamic && \
	rm -rf red-hat-developer-hub-backstage-plugin-sandbox && \
	yarn install && \
	npx @janus-idp/cli@latest package package-dynamic-plugins \
	  --tag $(IMAGE) \
	  --platform $(IMAGE_PLATFORM)
	podman push $(IMAGE)