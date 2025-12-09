# Developer Sandbox Plugin for Red Hat Developer Hub

This plugin provides the new developer sandbox experience for the Red Hat Developer Hub.

## Configuration

This plugin needs the following to be configured in the `app-config.local.yaml` file:

1. The URL of the registration-service-api production server.
2. The URL of the kube-api production server.
3. The site key for Google Recaptcha. The keys can be obtained from the Google Recaptcha admin console.

```sh
yarn install
yarn dev
```

To generate knip reports for this app, run:

```sh
yarn backstage-repo-tools knip-reports
```

## Development

To start the app locally, run:

1. `cd workspaces/sandbox`
2. `yarn install`
3. `make start-rhdh-local`

Please, note that every time you want to re deploy, you need to run:
`make stop-rhdh-local`

NOTE: the app uses prod RH SSO as auth provider and sandbox stage backend by default
( those can be configured in `deploy/app-config.yaml` )

Known issues:

- sometimes the local node build fails and you'll have to run `make stop-rhdh-local` and `make start-rhdh-local` again.
  This is what you will see when the build fails:
  ![Known Issues](./images/known_build_issue.png)

## Upgrading backstage

For upgrading backstage the `backstage-cli` should be used, for example:

```shell
npx backstage-cli versions:bump --release 1.36.1
```

More details on the upgrade process are available [keeping-backstage-updated](https://backstage.io/docs/getting-started/keeping-backstage-updated/)


## Running E2E Tests
The E2E tests live in a separate repository, but you can run them directly from this repo against your current working code.

*Prerequisites*:
1. You need a OCP cluster
    - ROSA cluster from ClusterBot will not work since we are not able to modify the OAuth configuration of ROSA clusters created by the ClusterBot.
2. Ensure you are using Node.js version 22
    - to easily manage it, you can run `nvm use 22`
3. Ensure you have `yarn` installed
4. Make sure you can log in at <https://sso.devsandbox.dev/auth/realms/sandbox-dev/account> using your `SSO_USERNAME` and `SSO_PASSWORD`. You can contact the [Developer Sandbox team](devsandbox@redhat.com) to obtain the test user credentials.
5. It's required that you create a repository called `sandbox-rhdh-plugin` in your quay organization and make it public

The following Makefile targets are available:

* `make test-e2e` - this target clones latest changes from [toolchain-e2e](https://github.com/codeready-toolchain/toolchain-e2e) and runs e2e tests. As deployment for `devsandbox-dashboard` it uses the current code that is at HEAD.
* `make test-e2e-local` - this target doesn't clone anything, but it runs e2e tests from the directory `../toolchain-e2e`. As deployment for `devsandbox-dashboard` it uses the current code that is at HEAD.
* `make test-e2e-in-container` — runs e2e tests inside a container; clones latest changes from [toolchain-e2e](https://github.com/codeready-toolchain/toolchain-e2e).
* `make test-e2e-local-in-container` — runs e2e tests inside a container from the directory `../toolchain-e2e`.


Note that you need to set `SSO_USERNAME` and `SSO_PASSWORD`. For example:
`make test-e2e SSO_USERNAME=${SSO_USERNAME} SSO_PASSWORD=${SSO_PASSWORD}`

For more detailed information, check [toolchain-e2e documentation](https://github.com/codeready-toolchain/toolchain-e2e/blob/master/test/e2e/sandbox-ui/README.md).