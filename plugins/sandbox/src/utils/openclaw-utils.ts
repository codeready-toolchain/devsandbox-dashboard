/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { OpenClawItem, SpaceRequestItem, StatusCondition } from '../types';

export enum OpenClawStatus {
  NEW = 'new', // nothing exists yet
  PROVISIONING = 'provisioning', // provisioning/booting
  UNKNOWN = 'unknown', // unknown status, might be provisioning/booting and, it doesn't have a status condition yet
  READY = 'ready', // ready to use
  FAILED = 'failed', // failed to provision
  IDLED = 'idled', // idled and not available to use
}

const isConditionTrue = (
  condType: string,
  conditions: StatusCondition[],
): [boolean, StatusCondition | null] => {
  for (const condition of conditions) {
    if (condition.type === condType && condition.status === 'True') {
      return [true, condition];
    }
  }
  return [false, null];
};

const isConditionFalse = (
  condType: string,
  conditions: StatusCondition[],
): [boolean, StatusCondition | null] => {
  for (const condition of conditions) {
    if (condition.type === condType && condition.status === 'False') {
      return [true, condition];
    }
  }
  return [false, null];
};

export const getOpenClawReadyCondition = (
  data: OpenClawItem | undefined,
  setError: (errorDetails: string) => void,
): OpenClawStatus => {
  console.log('claw data', data);
  if (!data) {
    console.log('claw data is undefined');
    return OpenClawStatus.UNKNOWN;
  }

  if (data.spec?.idle) {
    console.log('claw is idled');
    return OpenClawStatus.IDLED;
  }

  if (!data.status || !data.status.conditions?.length) {
    if (data.metadata?.creationTimestamp) {
      console.log(
        'claw exists but has no status conditions yet, treating as provisioning',
      );
      return OpenClawStatus.PROVISIONING;
    }
    console.log('claw is new, its status is undefined or empty');
    return OpenClawStatus.NEW;
  }

  const conditions = data?.status?.conditions;

  const [isSuccessful] = isConditionTrue('Ready', conditions);
  if (isSuccessful) {
    console.log('claw is ready');
    return OpenClawStatus.READY;
  }

  const [hasFailed, conditionFailure] = isConditionTrue('Failure', conditions);
  if (hasFailed) {
    if (conditionFailure) {
      setError(conditionFailure?.message);
    }
    console.log('claw has failed');
    return OpenClawStatus.FAILED;
  }

  const [isProvisioning, conditionProvisioning] = isConditionFalse(
    'Ready',
    conditions,
  );
  if (isProvisioning && conditionProvisioning?.reason === 'Provisioning') {
    console.log('claw is provisioning');
    return OpenClawStatus.PROVISIONING;
  }

  console.log('claw is unknown');
  return OpenClawStatus.UNKNOWN;
};

export const newSpaceRequestObject = (namespace: string): string =>
  JSON.stringify({
    apiVersion: 'toolchain.dev.openshift.com/v1alpha1',
    kind: 'SpaceRequest',
    metadata: {
      namespace: namespace,
      name: 'claw',
    },
    spec: {
      tierName: 'claw',
    },
  });

export const isSpaceRequestReady = (
  sr: SpaceRequestItem | undefined,
): boolean => {
  if (!sr?.status?.conditions) {
    return false;
  }
  const [ready] = isConditionTrue('Ready', sr.status.conditions);
  return ready;
};

export const getSpaceRequestNamespace = (
  sr: SpaceRequestItem | undefined,
): string | undefined => {
  if (!isSpaceRequestReady(sr)) {
    return undefined;
  }
  return sr?.status?.namespaceAccess?.[0]?.name;
};

export const newOpenClawObject = (
  namespace: string,
  name: string,
  secretName: string,
): string =>
  JSON.stringify({
    apiVersion: 'claw.sandbox.redhat.com/v1alpha1',
    kind: 'Claw',
    metadata: {
      namespace: namespace,
      name: name,
      labels: {
        'app.kubernetes.io/name': 'claw',
      },
    },
    spec: {
      credentials: [
        {
          name: 'gemini',
          type: 'apiKey',
          secretRef: [
            {
              name: secretName,
              key: 'api-key',
            },
          ],
          provider: 'google',
        },
      ],
    },
  });

export const newOpenClawAPIKeySecretObject = (
  namespace: string,
  name: string,
  apiKeyValue: string,
): string =>
  JSON.stringify({
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      namespace: namespace,
      name: name,
      labels: {
        'app.kubernetes.io/name': 'claw',
      },
    },
    stringData: {
      'api-key': apiKeyValue,
    },
  });
