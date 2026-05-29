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
import SvgIcon from '@mui/material/SvgIcon';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

type IconData = { path: string; hex: string };

// SVG paths sourced from Simple Icons (https://simpleicons.org)
const PROVIDER_ICONS: Record<string, IconData> = {
  anthropic: {
    hex: '191919',
    path: 'M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z',
  },
  xai: {
    hex: '000000',
    path: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  },
  gemini: {
    hex: '8E75B2',
    path: 'M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81',
  },
  'google-vertex': {
    hex: '4285F4',
    path: 'M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-2.821-4.552l-.043.043.006-.05A9.344 9.344 0 0 0 12.19 2.38zm-.358 4.146c1.244-.04 2.518.368 3.486 1.15a5.186 5.186 0 0 1 1.862 4.078v.518c3.53-.07 3.53 5.262 0 5.193h-5.193l-.008.009v-.04H6.785a2.59 2.59 0 0 1-1.067-.23h.001a2.597 2.597 0 1 1 3.437-3.437l3.013-3.012A6.747 6.747 0 0 0 8.11 8.24c.018-.01.04-.026.054-.023a5.186 5.186 0 0 1 3.67-1.69z',
  },
  openrouter: {
    hex: '94A3B8',
    path: 'M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z',
  },
  openai: {
    hex: '412991',
    path: 'M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 10.69.248a6.046 6.046 0 0 0-5.771 4.17 5.985 5.985 0 0 0-4 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 23.1a6.046 6.046 0 0 0 5.772-4.17 5.985 5.985 0 0 0 3.997-2.9 6.046 6.046 0 0 0-.747-6.209zM13.26 21.95a4.497 4.497 0 0 1-2.886-1.04l.143-.08 4.793-2.769a.777.777 0 0 0 .391-.676v-6.76l2.027 1.17a.072.072 0 0 1 .039.052v5.596a4.513 4.513 0 0 1-4.507 4.507zm-9.69-4.135a4.49 4.49 0 0 1-.54-3.016l.144.084 4.793 2.769a.78.78 0 0 0 .782 0l5.858-3.382v2.334a.072.072 0 0 1-.03.06l-4.851 2.8a4.513 4.513 0 0 1-6.156-1.65zM2.487 7.86a4.497 4.497 0 0 1 2.347-1.98v5.7a.78.78 0 0 0 .391.676l5.858 3.382-2.026 1.17a.072.072 0 0 1-.069.006l-4.851-2.8A4.513 4.513 0 0 1 2.487 7.86zM19.75 11.6l-5.857-3.382 2.026-1.17a.072.072 0 0 1 .069-.006l4.851 2.8a4.513 4.513 0 0 1-.7 8.13v-5.7a.78.78 0 0 0-.39-.676zm2.016-3.026l-.143-.084-4.794-2.77a.78.78 0 0 0-.782 0l-5.857 3.382V6.77a.072.072 0 0 1 .03-.06l4.85-2.8a4.513 4.513 0 0 1 6.696 4.66zM8.81 12.956l-2.026-1.17a.072.072 0 0 1-.039-.052V6.138a4.513 4.513 0 0 1 7.394-3.466l-.143.08-4.793 2.77a.78.78 0 0 0-.392.676zm1.1-2.371 2.609-1.506 2.61 1.506v3.012l-2.61 1.506-2.609-1.506z',
  },
};

type ProviderIconProps = {
  providerId: string;
  size?: number;
  className?: string;
};

export const ProviderIcon: React.FC<ProviderIconProps> = ({
  providerId,
  size = 20,
  className,
}) => {
  const iconData = PROVIDER_ICONS[providerId];

  if (!iconData) {
    return (
      <SmartToyOutlinedIcon
        className={className}
        sx={{ fontSize: size, color: 'text.secondary', flexShrink: 0 }}
      />
    );
  }

  const fill = iconData.hex === '000000' ? 'currentColor' : `#${iconData.hex}`;

  return (
    <SvgIcon
      className={className}
      sx={{ fontSize: size, flexShrink: 0 }}
      viewBox="0 0 24 24"
    >
      <path d={iconData.path} fill={fill} />
    </SvgIcon>
  );
};

export default ProviderIcon;
