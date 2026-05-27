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
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AAPData, OpenClawItem, SpaceRequestItem, SignupData } from '../types';
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
  getSpaceRequestNamespace,
} from '../utils/openclaw-utils';

interface OpenClawDataResult {
  status: OpenClawStatus;
  namespace: string | undefined;
}
import { errorMessage } from '../utils/common';
import {
  useSegmentAnalytics,
  SegmentTrackingData,
} from '../utils/segment-analytics';

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
  handleOpenClawInstance: (userNamespace: string, apiKeyValue?: string) => void;
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
  const [statusUnknown, setStatusUnknown] = React.useState(true);
  const [userFound, setUserFound] = useState<boolean>(false);
  const [userData, setData] = useState<SignupData | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [userReady, setUserReady] = useState<boolean>(false);
  const [verificationRequired, setVerificationRequired] =
    useState<boolean>(false);
  const [pendingApproval, setPendingApproval] = useState<boolean>(false);

  const segmentAnalytics = useSegmentAnalytics(segmentWriteKey, userData);

  const [ansibleData, setAnsibleData] = React.useState<AAPData | undefined>();
  const [ansibleUILink, setAnsibleUILink] = React.useState<
    string | undefined
  >();
  const [ansibleUIUser, setAnsibleUIUser] = React.useState<string>();
  const [ansibleUIPassword, setAnsibleUIPassword] = React.useState<string>('');
  const [ansibleStatus, setAnsibleStatus] = React.useState<AnsibleStatus>(
    AnsibleStatus.NEW,
  );
  const [ansibleError, setAnsibleError] = useState<string | null>(null);

  const [, setSpaceRequestData] = React.useState<
    SpaceRequestItem | undefined
  >();
  const [clawNamespace, setClawNamespace] = React.useState<
    string | undefined
  >();
  const pendingApiKey = React.useRef<string | undefined>(undefined);
  const [openclawData, setOpenclawData] = React.useState<
    OpenClawItem | undefined
  >();
  const [openclawStatus, setOpenclawStatus] = React.useState<OpenClawStatus>(
    OpenClawStatus.NEW,
  );
  const [openclawUILink, setOpenclawUILink] = React.useState<
    string | undefined
  >();
  const [openclawError, setOpenclawError] = useState<string | null>(null);

  const status = React.useMemo(
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

  const getAAPData = async (userNamespace: string) => {
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
    } catch (e) {
      setAnsibleError(errorMessage(e));
    }
  };

  const handleAAPInstance = async (userNamespace: string) => {
    await getAAPData(userNamespace);

    if (
      ansibleStatus === AnsibleStatus.PROVISIONING ||
      ansibleStatus === AnsibleStatus.READY
    ) {
      return;
    }

    if (
      ansibleStatus === AnsibleStatus.IDLED &&
      ansibleData &&
      ansibleData?.items?.length > 0
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

  const createClawInNamespace = async (
    targetNamespace: string,
    apiKeyValue: string,
  ) => {
    await openclawApi.createOpenClaw(targetNamespace, apiKeyValue);
  };

  const getOpenClawData = async (
    userNamespace: string,
  ): Promise<OpenClawDataResult> => {
    try {
      const sr = await openclawApi.getSpaceRequest(userNamespace);
      setSpaceRequestData(sr);

      if (!sr) {
        setOpenclawStatus(OpenClawStatus.NEW);
        return { status: OpenClawStatus.NEW, namespace: undefined };
      }

      const targetNamespace = getSpaceRequestNamespace(sr);
      if (!targetNamespace) {
        setOpenclawStatus(OpenClawStatus.PROVISIONING);
        return { status: OpenClawStatus.PROVISIONING, namespace: undefined };
      }

      setClawNamespace(targetNamespace);

      const data = await openclawApi.getOpenClaw(targetNamespace);
      setOpenclawData(data);

      if (!data && pendingApiKey.current) {
        const apiKey = pendingApiKey.current;
        pendingApiKey.current = undefined;
        try {
          await createClawInNamespace(targetNamespace, apiKey);
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

      const st = getOpenClawReadyCondition(data, e =>
        setOpenclawError(errorMessage(e)),
      );
      setOpenclawStatus(st);
      if (data?.status?.url) {
        const url = new URL(data.status.url);
        url.pathname = `${url.pathname.replace(
          /\/$/,
          '',
        )}/integration/device-pairing/`;
        setOpenclawUILink(url.toString());
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
    apiKeyValue?: string,
  ) => {
    const { status: currentStatus, namespace: resolvedNamespace } =
      await getOpenClawData(userNamespace);

    if (
      currentStatus === OpenClawStatus.PROVISIONING ||
      currentStatus === OpenClawStatus.READY
    ) {
      return;
    }

    if (currentStatus === OpenClawStatus.IDLED && resolvedNamespace) {
      try {
        await openclawApi.unIdleOpenClaw(resolvedNamespace);
        setOpenclawStatus(OpenClawStatus.PROVISIONING);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        setOpenclawError(errorMessage(e));
      }
      return;
    }

    if (!apiKeyValue) {
      return;
    }

    try {
      pendingApiKey.current = apiKeyValue;
      await openclawApi.createSpaceRequest(userNamespace);
      setOpenclawStatus(OpenClawStatus.PROVISIONING);
    } catch (e) {
      pendingApiKey.current = undefined;
      // eslint-disable-next-line no-console
      console.error(e);
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
    setSpaceRequestData(undefined);
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

  React.useEffect(() => {
    if (pollStatus) {
      const handle = setInterval(() => {
        fetchData(true);
      }, pollInterval);
      return () => clearInterval(handle);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollStatus, pollInterval]);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (userData?.defaultUserNamespace) {
      getOpenClawData(userData.defaultUserNamespace);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.defaultUserNamespace]);

  React.useEffect(() => {
    if (
      userData?.defaultUserNamespace &&
      openclawStatus === OpenClawStatus.PROVISIONING
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
