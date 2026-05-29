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
import { isEqual } from 'lodash';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AAPData, OpenClawItem, SignupData } from '../types';
import { AddedCredential } from '../utils/openclaw-providers';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { aapApiRef, kubeApiRef, openclawApiRef, registerApiRef } from '../api';
import { useRecaptcha } from './useRecaptcha';
import { LONG_INTERVAL, SandboxEnvironment, SHORT_INTERVAL } from '../const';
import { signupDataToStatus } from '../utils/register-utils';
import { AnsibleStatus, decode, getReadyCondition } from '../utils/aap-utils';
import {
  OpenClawStatus,
  getOpenClawReadyCondition,
  isSpaceRequestReady,
  isSpaceRequestTerminating,
  getSpaceRequestNamespace,
} from '../utils/openclaw-utils';

import { errorMessage } from '../utils/common';
import {
  useSegmentAnalytics,
  SegmentTrackingData,
} from '../utils/segment-analytics';

interface AAPDataResult {
  status: AnsibleStatus;
  data: AAPData | undefined;
}

interface OpenClawDataResult {
  status: OpenClawStatus;
  namespace: string | undefined;
}

interface SandboxContextType {
  userStatus: string;
  userFound: boolean;
  userReady: boolean;
  verificationRequired: boolean;
  pendingApproval: boolean;
  userData: SignupData | undefined;
  loading: boolean;
  refetchUserData: () => Promise<SignupData | undefined>;
  signupUser: () => void;
  refetchAAP: (userNamespace: string) => void;
  handleAAPInstance: (userNamespace: string) => void;
  ansibleData: AAPData | undefined;
  ansibleUIUser: string | undefined;
  ansibleUIPassword: string;
  ansibleUILink: string | undefined;
  ansibleError: string | null;
  ansibleStatus: AnsibleStatus;
  openclawData: OpenClawItem | undefined;
  openclawError: string | null;
  openclawStatus: OpenClawStatus;
  openclawUILink: string | undefined;
  handleOpenClawInstance: (
    userNamespace: string,
    credentials?: AddedCredential[],
    disableDevicePairing?: boolean,
  ) => Promise<boolean>;
  deleteOpenClaw: (userNamespace: string) => Promise<void>;
  refetchOpenClaw: (userNamespace: string) => Promise<OpenClawDataResult>;
  segmentTrackClick?: (data: SegmentTrackingData) => Promise<void>;
  marketoWebhookURL?: string;
  disabledIntegrations?: string[];
}

const SandboxContext = createContext<SandboxContextType | undefined>(undefined);

export const useSandboxContext = (): SandboxContextType => {
  const context = useContext(SandboxContext);
  if (!context) {
    throw new Error('Context useSandboxContext is not defined');
  }
  return context;
};

export const SandboxProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const configApi = useApi(configApiRef);
  const isProd =
    (configApi.getOptionalString('sandbox.environment') ??
      SandboxEnvironment.PROD) !== SandboxEnvironment.DEV;
  useRecaptcha(isProd);
  const aapApi = useApi(aapApiRef);
  const openclawApi = useApi(openclawApiRef);
  const kubeApi = useApi(kubeApiRef);
  const registerApi = useApi(registerApiRef);
  const [segmentWriteKey, setSegmentWriteKey] = useState<string>();
  const [marketoWebhookURL, setMarketoWebhookURL] = useState<string>();
  const [disabledIntegrations, setDisabledIntegrations] = useState<
    string[] | undefined
  >();
  const [statusUnknown, setStatusUnknown] = useState(true);
  const [userFound, setUserFound] = useState<boolean>(false);
  const [userData, setData] = useState<SignupData | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [userReady, setUserReady] = useState<boolean>(false);
  const [verificationRequired, setVerificationRequired] =
    useState<boolean>(false);
  const [pendingApproval, setPendingApproval] = useState<boolean>(false);

  const segmentAnalytics = useSegmentAnalytics(segmentWriteKey, userData);

  const [ansibleData, setAnsibleData] = useState<AAPData | undefined>();
  const [ansibleUILink, setAnsibleUILink] = useState<string | undefined>();
  const [ansibleUIUser, setAnsibleUIUser] = useState<string>();
  const [ansibleUIPassword, setAnsibleUIPassword] = useState<string>('');
  const [ansibleStatus, setAnsibleStatus] = useState<AnsibleStatus>(
    AnsibleStatus.NEW,
  );
  const [ansibleError, setAnsibleError] = useState<string | null>(null);

  const [clawNamespace, setClawNamespace] = useState<string | undefined>();
  const pendingCredentials = useRef<AddedCredential[] | undefined>(undefined);
  const pendingDisableDevicePairing = useRef<boolean>(false);
  const creatingSpaceRequest = useRef(false);
  const [openclawData, setOpenclawData] = useState<OpenClawItem | undefined>();
  const [openclawStatus, setOpenclawStatus] = useState<OpenClawStatus>(
    OpenClawStatus.NEW,
  );
  const [openclawUILink, setOpenclawUILink] = useState<string | undefined>();
  const [openclawError, setOpenclawError] = useState<string | null>(null);

  const status = useMemo(
    () => (statusUnknown ? 'unknown' : signupDataToStatus(userData)),
    [statusUnknown, userData],
  );

  useEffect(() => {
    setVerificationRequired(status === 'verify');
    setPendingApproval(status === 'pending-approval');
    setUserReady(status === 'ready');
  }, [status]);

  const fetchData = async (
    isRefetch = false,
  ): Promise<SignupData | undefined> => {
    if (!isRefetch) {
      setLoading(true);
    }

    let result;
    try {
      result = await registerApi.getSignUpData();
      if (!isEqual(userData, result)) {
        setData(result);
      }
      if (result) {
        setUserFound(true);
      } else {
        setUserFound(false);
      }
    } catch (err) {
      // eslint-disable-next-line
      console.error('Error fetching user data:', err);
      setData(undefined);
      setUserFound(false);
    } finally {
      setLoading(false);
      setStatusUnknown(false);
    }
    return result;
  };

  const signupUser = async () => {
    setLoading(true);
    try {
      await registerApi.signup();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error during signup', err);
    } finally {
      setLoading(false);
    }
  };

  const getAAPData = async (userNamespace: string): Promise<AAPDataResult> => {
    try {
      const data = await aapApi.getAAP(userNamespace);
      setAnsibleData(data);
      const st = getReadyCondition(data, e => setAnsibleError(errorMessage(e)));
      setAnsibleStatus(st);
      if (data && data?.items?.length > 0 && data?.items[0]?.status) {
        if (data?.items[0]?.status?.URL) {
          setAnsibleUILink(data.items[0].status.URL);
        }
        if (data?.items[0]?.status?.adminUser) {
          setAnsibleUIUser(data?.items[0]?.status?.adminUser);
        }
        if (data?.items[0]?.status?.adminPasswordSecret) {
          const adminSecret = await kubeApi.getSecret(
            userNamespace,
            data?.items[0]?.status?.adminPasswordSecret,
          );
          if (adminSecret?.data) {
            setAnsibleUIPassword(decode(adminSecret?.data?.password));
          }
        }
      }
      return { status: st, data };
    } catch (e) {
      setAnsibleError(errorMessage(e));
      return { status: AnsibleStatus.UNKNOWN, data: undefined };
    }
  };

  const handleAAPInstance = async (userNamespace: string) => {
    const { status: currentStatus, data: currentData } = await getAAPData(
      userNamespace,
    );

    if (
      currentStatus === AnsibleStatus.PROVISIONING ||
      currentStatus === AnsibleStatus.READY
    ) {
      return;
    }

    if (
      currentStatus === AnsibleStatus.IDLED &&
      currentData &&
      currentData?.items?.length > 0
    ) {
      try {
        await aapApi.unIdleAAP(userNamespace);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
      return;
    }
    try {
      await aapApi.createAAP(userNamespace);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const getOpenClawData = async (
    userNamespace: string,
  ): Promise<OpenClawDataResult> => {
    try {
      const sr = await openclawApi.getSpaceRequest(userNamespace);

      if (!sr) {
        if (pendingCredentials.current && !creatingSpaceRequest.current) {
          creatingSpaceRequest.current = true;
          try {
            await openclawApi.createSpaceRequest(userNamespace);
            setOpenclawStatus(OpenClawStatus.PROVISIONING);
            return {
              status: OpenClawStatus.PROVISIONING,
              namespace: undefined,
            };
          } catch (e) {
            pendingCredentials.current = undefined;
            setOpenclawError(errorMessage(e));
            setOpenclawStatus(OpenClawStatus.NEW);
            return { status: OpenClawStatus.NEW, namespace: undefined };
          } finally {
            creatingSpaceRequest.current = false;
          }
        }
        setOpenclawStatus(OpenClawStatus.NEW);
        return { status: OpenClawStatus.NEW, namespace: undefined };
      }

      if (isSpaceRequestTerminating(sr)) {
        setOpenclawStatus(OpenClawStatus.TERMINATING);
        return { status: OpenClawStatus.TERMINATING, namespace: undefined };
      }

      const targetNamespace = getSpaceRequestNamespace(sr);
      if (!targetNamespace) {
        setOpenclawStatus(OpenClawStatus.PROVISIONING);
        return { status: OpenClawStatus.PROVISIONING, namespace: undefined };
      }

      setClawNamespace(targetNamespace);

      const data = await openclawApi.getOpenClaw(targetNamespace);
      setOpenclawData(data);

      if (!data && pendingCredentials.current) {
        const credentials = pendingCredentials.current;
        const disableDevicePairing = pendingDisableDevicePairing.current;
        try {
          await openclawApi.createOpenClaw(
            targetNamespace,
            credentials,
            disableDevicePairing,
          );
          pendingCredentials.current = undefined;
          pendingDisableDevicePairing.current = false;
          setOpenclawStatus(OpenClawStatus.PROVISIONING);
          return {
            status: OpenClawStatus.PROVISIONING,
            namespace: targetNamespace,
          };
        } catch (e) {
          setOpenclawError(errorMessage(e));
          setOpenclawStatus(OpenClawStatus.UNKNOWN);
          return { status: OpenClawStatus.UNKNOWN, namespace: targetNamespace };
        }
      }

      const st = getOpenClawReadyCondition(data, setOpenclawError);
      setOpenclawStatus(st);
      if (data?.status?.url) {
        try {
          const url = new URL(data.status.url);
          if (!data.spec?.auth?.disableDevicePairing) {
            url.pathname = `${url.pathname.replace(
              /\/$/,
              '',
            )}/integration/device-pairing/`;
          }
          setOpenclawUILink(url.toString());
        } catch {
          setOpenclawUILink(data.status.url);
        }
      }

      if (st === OpenClawStatus.UNKNOWN && isSpaceRequestReady(sr)) {
        setOpenclawStatus(OpenClawStatus.PROVISIONING);
        return {
          status: OpenClawStatus.PROVISIONING,
          namespace: targetNamespace,
        };
      }

      return { status: st, namespace: targetNamespace };
    } catch (e) {
      setOpenclawError(errorMessage(e));
      return { status: OpenClawStatus.UNKNOWN, namespace: undefined };
    }
  };

  const handleOpenClawInstance = async (
    userNamespace: string,
    credentials?: AddedCredential[],
    disableDevicePairing?: boolean,
  ): Promise<boolean> => {
    const { status: currentStatus, namespace: resolvedNamespace } =
      await getOpenClawData(userNamespace);

    if (
      currentStatus === OpenClawStatus.PROVISIONING ||
      currentStatus === OpenClawStatus.READY
    ) {
      return true;
    }

    if (currentStatus === OpenClawStatus.TERMINATING) {
      if (!credentials || credentials.length === 0) {
        return false;
      }
      pendingCredentials.current = credentials;
      pendingDisableDevicePairing.current = disableDevicePairing ?? false;
      setOpenclawStatus(OpenClawStatus.TERMINATING);
      return true;
    }

    if (currentStatus === OpenClawStatus.IDLED && resolvedNamespace) {
      try {
        await openclawApi.unIdleOpenClaw(resolvedNamespace);
        setOpenclawStatus(OpenClawStatus.PROVISIONING);
        return true;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        setOpenclawError(errorMessage(e));
        return false;
      }
    }

    if (!credentials || credentials.length === 0) {
      return false;
    }

    try {
      pendingCredentials.current = credentials;
      pendingDisableDevicePairing.current = disableDevicePairing ?? false;
      await openclawApi.createSpaceRequest(userNamespace);
      setOpenclawStatus(OpenClawStatus.PROVISIONING);
      return true;
    } catch (e) {
      pendingCredentials.current = undefined;
      setOpenclawError(errorMessage(e));
      // eslint-disable-next-line no-console
      console.error(e);
      return false;
    }
  };

  const deleteOpenClaw = async (userNamespace: string) => {
    const results = await Promise.allSettled([
      clawNamespace
        ? openclawApi.deleteOpenClawCR(clawNamespace)
        : Promise.resolve(),
      openclawApi.deleteSpaceRequest(userNamespace),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        // eslint-disable-next-line no-console
        console.error(result.reason);
      }
    }

    setClawNamespace(undefined);
    setOpenclawData(undefined);
    setOpenclawStatus(OpenClawStatus.NEW);
    setOpenclawUILink(undefined);
    setOpenclawError(null);
  };

  useEffect(() => {
    fetchData(); // Initial fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Segment Analytics
  useEffect(() => {
    if (!isProd) {
      return;
    }
    const fetchSegmentWriteKey = async () => {
      try {
        const writeKey = await registerApi.getSegmentWriteKey();
        setSegmentWriteKey(writeKey);
      } catch (error) {
        // Failed to fetch Segment write key, continue without Segment tracking
      }
    };
    fetchSegmentWriteKey();
  }, [registerApi, isProd]);

  // Fetch the marketo URL and the disabled integrations from the registration
  // service.
  useEffect(() => {
    const fetchUIConfig = async () => {
      try {
        const uiConfig = await registerApi.getUIConfig();
        if (uiConfig.workatoWebHookURL) {
          setMarketoWebhookURL(uiConfig.workatoWebHookURL);
        }
        setDisabledIntegrations(
          Array.isArray(uiConfig.disabledIntegrations)
            ? uiConfig.disabledIntegrations
            : [],
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error fetching UI config:', err);
        setDisabledIntegrations([]);
      }
    };
    fetchUIConfig();
  }, [registerApi]);

  const pollStatus = userFound && !userReady;
  const pollInterval =
    status === 'provisioning' ? SHORT_INTERVAL : LONG_INTERVAL;

  useEffect(() => {
    if (pollStatus) {
      const handle = setInterval(() => {
        fetchData(true);
      }, pollInterval);
      return () => clearInterval(handle);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollStatus, pollInterval]);

  useEffect(() => {
    if (userData?.defaultUserNamespace) {
      const handle = setInterval(
        getAAPData,
        SHORT_INTERVAL,
        userData?.defaultUserNamespace,
      );
      return () => {
        clearInterval(handle);
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, ansibleStatus]);

  useEffect(() => {
    if (userData?.defaultUserNamespace) {
      getOpenClawData(userData.defaultUserNamespace);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.defaultUserNamespace]);

  useEffect(() => {
    if (
      userData?.defaultUserNamespace &&
      (openclawStatus === OpenClawStatus.PROVISIONING ||
        openclawStatus === OpenClawStatus.TERMINATING)
    ) {
      const handle = setInterval(
        getOpenClawData,
        SHORT_INTERVAL,
        userData.defaultUserNamespace,
      );
      return () => {
        clearInterval(handle);
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.defaultUserNamespace, openclawStatus]);

  return (
    <SandboxContext.Provider
      value={{
        userStatus: status,
        userFound,
        userReady,
        verificationRequired,
        pendingApproval,
        userData,
        loading,
        refetchUserData: fetchData,
        signupUser,
        refetchAAP: getAAPData,
        handleAAPInstance,
        ansibleData,
        ansibleUIUser,
        ansibleUIPassword,
        ansibleUILink,
        ansibleError,
        ansibleStatus,
        openclawData,
        openclawError,
        openclawStatus,
        openclawUILink,
        handleOpenClawInstance,
        deleteOpenClaw,
        refetchOpenClaw: getOpenClawData,
        segmentTrackClick: segmentAnalytics.trackClick,
        marketoWebhookURL,
        disabledIntegrations,
      }}
    >
      {children}
    </SandboxContext.Provider>
  );
};
