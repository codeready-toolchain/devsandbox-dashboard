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

import { useCallback } from 'react';
import { useSandboxContext } from '../hooks/useSandboxContext';
import { trackMarketoEvent } from './marketo-utils';

/**
 * React hook for triple analytics tracking (Adobe EDDL + Segment + Marketo)
 * This hook returns a function that tracks events to:
 * - Adobe Analytics (via EDDL)
 * - Segment Analytics
 * - Marketo (for Catalog clicks only)
 */
export const useTrackAnalytics = () => {
  const { segmentTrackClick, userData, marketoWebhookURL } =
    useSandboxContext();

  return useCallback(
    async (
      itemName: string,
      section: 'Catalog' | 'Activities' | 'Support' | 'Verification',
      href: string,
      internalCampaign?: string,
      linkType: 'cta' | 'default' = 'default',
    ) => {
      // Segment tracking (if available from context)
      if (segmentTrackClick) {
        try {
          await segmentTrackClick({
            itemName,
            section,
            href,
            internalCampaign,
            linkType,
          });
        } catch (error) {
          // Segment tracking failed, continue without blocking user experience
        }
      }

      // Marketo tracking (Catalog clicks only)
      if (section === 'Catalog') {
        try {
          await trackMarketoEvent(
            userData,
            internalCampaign,
            marketoWebhookURL,
          );
        } catch (error) {
          // Marketo tracking failed, continue without blocking user experience
        }
      }
    },
    [segmentTrackClick, userData, marketoWebhookURL],
  );
};
