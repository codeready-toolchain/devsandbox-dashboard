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
import { OpenClawItem, SpaceRequestItem } from '../types';
import { isConditionTrue, isConditionFalse } from './condition-utils';

export enum OpenClawStatus {
  NEW = 'new',
  PROVISIONING = 'provisioning',
  UNKNOWN = 'unknown',
  READY = 'ready',
  FAILED = 'failed',
  IDLED = 'idled',
  TERMINATING = 'terminating',
}

export const getOpenClawReadyCondition = (
  data: OpenClawItem | undefined,
  setError: (errorDetails: string) => void,
): OpenClawStatus => {
  if (!data) {
    return OpenClawStatus.UNKNOWN;
  }

  if (data.spec?.idle) {
    return OpenClawStatus.IDLED;
  }

  const conditions = data.status?.conditions;
  if (!conditions?.length) {
    if (data.metadata?.creationTimestamp) {
      return OpenClawStatus.PROVISIONING;
    }
    return OpenClawStatus.NEW;
  }

  const [isSuccessful] = isConditionTrue('Ready', conditions);
  if (isSuccessful) {
    return OpenClawStatus.READY;
  }

  const [hasFailed, conditionFailure] = isConditionTrue('Failure', conditions);
  if (hasFailed) {
    if (conditionFailure) {
      setError(conditionFailure.message);
    }
    return OpenClawStatus.FAILED;
  }

  const [isProvisioning, conditionProvisioning] = isConditionFalse(
    'Ready',
    conditions,
  );
  if (isProvisioning && conditionProvisioning?.reason === 'Provisioning') {
    return OpenClawStatus.PROVISIONING;
  }

  return OpenClawStatus.UNKNOWN;
};

export const newSpaceRequestObject = (namespace: string): string =>
  JSON.stringify({
    apiVersion: 'toolchain.dev.openshift.com/v1alpha1',
    kind: 'SpaceRequest',
    metadata: {
      namespace: namespace,
      name: 'claw',
      labels: {
        'claw.sandbox.redhat.com/instance': 'claw',
      },
    },
    spec: {
      tierName: 'claw',
    },
  });

export const isSpaceRequestTerminating = (
  sr: SpaceRequestItem | undefined,
): boolean => {
  if (!sr?.status?.conditions) {
    return false;
  }
  const [notReady, condition] = isConditionFalse('Ready', sr.status.conditions);
  return notReady && condition?.reason === 'Terminating';
};

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

export type OpenClawCredentialInput = {
  name: string;
  type: string;
  provider: string;
  secretName: string;
  secretKeys: string[];
};

export const newOpenClawObject = (
  namespace: string,
  name: string,
  credentials: OpenClawCredentialInput[],
  disableDevicePairing: boolean,
): string =>
  JSON.stringify({
    apiVersion: 'claw.sandbox.redhat.com/v1alpha1',
    kind: 'Claw',
    metadata: {
      namespace: namespace,
      name: name,
      labels: {
        'app.kubernetes.io/name': 'claw',
        'claw.sandbox.redhat.com/instance': name,
      },
    },
    spec: {
      credentials: credentials.map(cred => ({
        name: cred.name,
        type: cred.type,
        secretRef: cred.secretKeys.map(key => ({
          name: cred.secretName,
          key,
        })),
        provider: cred.provider,
      })),
      auth: {
        disableDevicePairing: disableDevicePairing,
      },
    },
  });

export const newOpenClawSecretObject = (
  namespace: string,
  name: string,
  data: Record<string, string>,
  instanceName = 'claw',
): string =>
  JSON.stringify({
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      namespace: namespace,
      name: name,
      labels: {
        'app.kubernetes.io/name': 'claw',
        'claw.sandbox.redhat.com/instance': instanceName,
      },
    },
    stringData: data,
  });
