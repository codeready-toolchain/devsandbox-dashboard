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

import React from 'react';
import Button from '@mui/material/Button';
import { Theme } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import { useSandboxContext } from '../../hooks/useSandboxContext';
import { AnsibleStatus } from '../../utils/aap-utils';
import { OpenClawStatus } from '../../utils/openclaw-utils';
import { Product } from './productData';

type SandboxCatalogCardDeleteButtonProps = {
  id: Product;
  handleDeleteButtonClick: (id: Product) => void;
  theme: Theme;
  isDeleting: boolean;
};

const deletableAAPStatuses: string[] = [
  AnsibleStatus.IDLED,
  AnsibleStatus.PROVISIONING,
  AnsibleStatus.READY,
  AnsibleStatus.UNKNOWN,
];

const deletableOpenClawStatuses: string[] = [
  OpenClawStatus.DELETING,
  OpenClawStatus.FAILED,
  OpenClawStatus.IDLED,
  OpenClawStatus.PROVISIONING,
  OpenClawStatus.READY,
];

export const SandboxCatalogCardDeleteButton: React.FC<
  SandboxCatalogCardDeleteButtonProps
> = ({ id, handleDeleteButtonClick, theme, isDeleting }) => {
  const { ansibleStatus, openclawStatus } = useSandboxContext();

  const shouldShow =
    (id === Product.AAP && deletableAAPStatuses.includes(ansibleStatus)) ||
    (id === Product.OPENCLAW &&
      deletableOpenClawStatuses.includes(openclawStatus));

  if (!shouldShow) return null;

  const isOpenClawDeleting =
    id === Product.OPENCLAW && openclawStatus === OpenClawStatus.DELETING;
  const effectivelyDeleting = isDeleting || isOpenClawDeleting;

  const isProvisioning =
    (id === Product.AAP && ansibleStatus === AnsibleStatus.PROVISIONING) ||
    (id === Product.OPENCLAW && openclawStatus === OpenClawStatus.PROVISIONING);

  return (
    <Button
      size="medium"
      color="primary"
      variant="contained"
      data-testid={`delete-${id}`}
      disabled={effectivelyDeleting}
      onClick={() => {
        if (!effectivelyDeleting) handleDeleteButtonClick(id);
      }}
      endIcon={
        effectivelyDeleting && (
          <CircularProgress
            size={20}
            sx={{ color: theme.palette.common.white }}
          />
        )
      }
      sx={{
        marginTop: theme.spacing(0.5),
      }}
    >
      {isOpenClawDeleting ? 'Deleting' : isProvisioning ? 'Stop' : 'Delete'}
    </Button>
  );
};
