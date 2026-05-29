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
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { OpenClawLaunchInfoModal } from '../OpenClawLaunchInfoModal';
import { useSandboxContext } from '../../../hooks/useSandboxContext';
import { OpenClawStatus } from '../../../utils/openclaw-utils';
import { wrapInTestApp } from '@backstage/test-utils';

jest.mock('../../../hooks/useSandboxContext');

describe('OpenClawLaunchInfoModal', () => {
  const theme = createTheme();
  const mockSetOpen = jest.fn();
  const mockHandleOpenClawInstance = jest.fn();

  const defaultProps = {
    modalOpen: true,
    setOpen: mockSetOpen,
  };

  const mockUseSandboxContext = useSandboxContext as jest.MockedFunction<
    typeof useSandboxContext
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderModal = (contextOverrides = {}) => {
    mockUseSandboxContext.mockReturnValue({
      userData: { defaultUserNamespace: 'test-namespace' },
      openclawError: null,
      openclawStatus: OpenClawStatus.NEW,
      handleOpenClawInstance: mockHandleOpenClawInstance,
      ...contextOverrides,
    } as any);

    return render(
      wrapInTestApp(
        <ThemeProvider theme={theme}>
          <OpenClawLaunchInfoModal {...defaultProps} />
        </ThemeProvider>,
      ),
    );
  };

  it('renders the new state with provider search and provision button', () => {
    renderModal();

    expect(
      screen.getByText(/Provision OpenClaw instance/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Configure your AI provider credentials/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Search providers/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Provision/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('disables the Provision button when no credentials are added', () => {
    renderModal();

    const provisionButton = screen.getByRole('button', { name: /Provision/i });
    expect(provisionButton).toBeDisabled();
  });

  it('renders the ready state correctly', () => {
    renderModal({ openclawStatus: OpenClawStatus.READY });

    expect(
      screen.getByText(/OpenClaw instance provisioned/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your OpenClaw instance is ready to use/i),
    ).toBeInTheDocument();
  });

  it('renders the provisioning state correctly', () => {
    renderModal({ openclawStatus: OpenClawStatus.PROVISIONING });

    expect(
      screen.getByText(/Provisioning OpenClaw instance/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Provisioning is in progress/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error message during provisioning when openclawError is set', () => {
    const errorMsg = 'Something went wrong';
    renderModal({
      openclawStatus: OpenClawStatus.PROVISIONING,
      openclawError: errorMsg,
    });

    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it('calls setOpen(false) when close button is clicked', () => {
    renderModal();

    fireEvent.click(screen.getByLabelText('close'));
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  it('calls setOpen(false) when Cancel button is clicked', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  it('shows the device pairing switch', () => {
    renderModal();

    expect(screen.getByLabelText(/Enable device pairing/i)).toBeInTheDocument();
  });

  it('shows provider credential form when a provider is selected', async () => {
    renderModal();

    const autocomplete = screen.getByLabelText(/Search providers/i);
    fireEvent.change(autocomplete, { target: { value: 'Google Gemini' } });
    fireEvent.keyDown(autocomplete, { key: 'ArrowDown' });
    fireEvent.keyDown(autocomplete, { key: 'Enter' });

    expect(await screen.findByText('Google Gemini')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Add Credential/i }),
    ).toBeInTheDocument();
  });
});
