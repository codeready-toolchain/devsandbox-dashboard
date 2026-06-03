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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { OpenClawLaunchInfoModal } from '../OpenClawLaunchInfoModal';
import { useSandboxContext } from '../../../hooks/useSandboxContext';
import { OpenClawStatus } from '../../../utils/openclaw-utils';
import { Product } from '../../SandboxCatalog/productData';
import { wrapInTestApp } from '@backstage/test-utils';

jest.mock('../../../hooks/useSandboxContext');

describe('OpenClawLaunchInfoModal', () => {
  const theme = createTheme();
  const mockSetOpen = jest.fn();
  const mockHandleTryButtonClick = jest.fn();
  const mockHandleOpenClawInstance = jest.fn();

  const defaultProps = {
    handleTryButtonClick: mockHandleTryButtonClick,
    id: Product.OPENCLAW,
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

  it('renders the new state with provider search, add button, and provision button', () => {
    renderModal();

    expect(
      screen.getByText(/Provision OpenClaw instance/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Configure your AI provider credentials/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Search providers/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Add another AI provider credential/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Provision/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('disables the add button while an empty credential entry exists', () => {
    renderModal();

    const addButton = screen
      .getByText(/Add another AI provider credential/i)
      .closest('button')!;
    expect(addButton).toBeDisabled();
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

  it('calls handleTryButtonClick and closes when Launch button is clicked in ready state', () => {
    renderModal({ openclawStatus: OpenClawStatus.READY });

    fireEvent.click(screen.getByRole('button', { name: /Launch/i }));
    expect(mockHandleTryButtonClick).toHaveBeenCalledWith(Product.OPENCLAW);
    expect(mockSetOpen).toHaveBeenCalledWith(false);
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

  it('shows provider credential form when a provider is selected', async () => {
    renderModal();

    const autocomplete = screen.getByLabelText(/Search providers/i);
    fireEvent.mouseDown(autocomplete);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const option = screen.getByRole('option', { name: /Google Gemini/i });
    fireEvent.click(option);

    await waitFor(() => {
      expect(
        screen.getByText(/Get a key for Google Gemini/i),
      ).toBeInTheDocument();
    });
  });

  it('does not show delete button when no provider is selected', () => {
    renderModal();

    expect(
      screen.queryByRole('button', { name: /Delete credential/i }),
    ).not.toBeInTheDocument();
  });

  it('shows delete button for a single selected provider', async () => {
    renderModal();

    const autocomplete = screen.getByLabelText(/Search providers/i);
    fireEvent.mouseDown(autocomplete);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('option', { name: /Google Gemini/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Delete credential/i }),
      ).toBeInTheDocument();
    });
  });

  it('resets to provider selection after deleting the only provider', async () => {
    renderModal();

    const autocomplete = screen.getByLabelText(/Search providers/i);
    fireEvent.mouseDown(autocomplete);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('option', { name: /Google Gemini/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Delete credential/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Delete credential/i }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Search providers/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /Delete credential/i }),
    ).not.toBeInTheDocument();
  });

  it('shows delete buttons when multiple credential entries exist', async () => {
    renderModal();

    const autocomplete = screen.getByLabelText(/Search providers/i);
    fireEvent.mouseDown(autocomplete);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('option', { name: /Google Gemini/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Add another AI provider credential/i),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Add another AI provider credential/i));

    expect(
      screen.getAllByRole('button', { name: /Delete credential/i }),
    ).toHaveLength(2);
  });
});
