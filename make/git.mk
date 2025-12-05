GIT_COMMIT_ID_SHORT := $(shell git rev-parse --short HEAD)
ifneq ($(shell git status --porcelain --untracked-files=no),)
       GIT_COMMIT_ID_SHORT := $(GIT_COMMIT_ID_SHORT)-dirty
endif
