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
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CancelIcon from '@mui/icons-material/Cancel';
import { AddedCredential } from '../../utils/openclaw-providers';

export type { AddedCredential } from '../../utils/openclaw-providers';

type CredentialListProps = {
  credentials: AddedCredential[];
  onDelete: (providerId: string) => void;
  showAddButton?: boolean;
  onAdd?: () => void;
};

export const CredentialList: React.FC<CredentialListProps> = ({
  credentials,
  onDelete,
  showAddButton = false,
  onAdd,
}) => {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
        Added credentials:
      </Typography>
      <Box
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
      >
        {credentials.map(cred => (
          <Chip
            key={cred.provider.id}
            label={cred.provider.name}
            onDelete={() => onDelete(cred.provider.id)}
            deleteIcon={
              <Tooltip title="Delete credential">
                <CancelIcon />
              </Tooltip>
            }
            color="primary"
            variant="outlined"
            size="small"
          />
        ))}
        {showAddButton && (
          <Chip
            label={
              credentials.length > 0
                ? 'Add another AI provider credential'
                : 'Add AI provider credential'
            }
            onClick={onAdd}
            variant="filled"
            size="small"
          />
        )}
      </Box>
    </Box>
  );
};

export default CredentialList;
