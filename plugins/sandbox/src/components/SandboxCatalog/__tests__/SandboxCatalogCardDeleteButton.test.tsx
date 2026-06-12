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
import { useSandboxContext } from '../../../hooks/useSandboxContext';
import { AnsibleStatus } from '../../../utils/aap-utils';
import { OpenClawStatus } from '../../../utils/openclaw-utils';
import { Product } from '../productData';
import { wrapInTestApp } from '@backstage/test-utils';
import { SandboxCatalogCardDeleteButton } from '../SandboxCatalogCardDeleteButton';

// Mock the useSandboxContext hook
jest.mock('../../../hooks/useSandboxContext');

describe('SandboxCatalogCardDeleteButton', () => {
  const theme = createTheme();
  const mockHandleDeleteButtonClick = jest.fn();

  const defaultProps = {
    id: Product.AAP,
    handleDeleteButtonClick: mockHandleDeleteButtonClick,
    theme: theme,
    isDeleting: false,
  };

  const mockUseSandboxContext = useSandboxContext as jest.MockedFunction<
    typeof useSandboxContext
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSandboxContext.mockReturnValue({
      ansibleStatus: AnsibleStatus.UNKNOWN,
    } as any);
  });

  const renderButton = (props = {}) => {
    return render(
      wrapInTestApp(
        <ThemeProvider theme={theme}>
          <SandboxCatalogCardDeleteButton {...defaultProps} {...props} />
        </ThemeProvider>,
      ),
    );
  };

  it('renders only for AAP card', () => {
    renderButton({ id: Product.OPENSHIFT_CONSOLE });
    const deleteButton = document.querySelector(
      `[data-testid="delete-${Product.OPENSHIFT_CONSOLE}"]`,
    );
    expect(deleteButton).toBeNull();
  });

  it('shows Stop when AAP is provisioning', () => {
    mockUseSandboxContext.mockReturnValue({
      ansibleStatus: AnsibleStatus.PROVISIONING,
    } as any);
    renderButton();
    const stopButton = screen.getByRole('button', { name: /Stop/i });
    expect(stopButton).toBeInTheDocument();
  });

  it('shows Delete when AAP status is unknown', () => {
    renderButton();
    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it('shows Delete when AAP is ready', () => {
    mockUseSandboxContext.mockReturnValue({
      ansibleStatus: AnsibleStatus.READY,
    } as any);
    renderButton();
    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it('shows Delete when AAP is idled', () => {
    mockUseSandboxContext.mockReturnValue({
      ansibleStatus: AnsibleStatus.IDLED,
    } as any);
    renderButton();
    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
  });

  it('calls HandleDeleteButtonClick when clicked', () => {
    renderButton();
    const deleteButton = screen.getByRole('button', { name: /Delete/i });
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton);
    expect(mockHandleDeleteButtonClick).toHaveBeenCalled();
  });

  describe('OpenClaw DELETING status', () => {
    it('shows disabled "Deleting" button with spinner when OpenClaw is deleting', () => {
      mockUseSandboxContext.mockReturnValue({
        ansibleStatus: AnsibleStatus.NEW,
        openclawStatus: OpenClawStatus.DELETING,
      } as any);
      renderButton({ id: Product.OPENCLAW });
      const button = screen.getByRole('button', { name: /Deleting/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('does not call handleDeleteButtonClick when OpenClaw is deleting', () => {
      mockUseSandboxContext.mockReturnValue({
        ansibleStatus: AnsibleStatus.NEW,
        openclawStatus: OpenClawStatus.DELETING,
      } as any);
      renderButton({ id: Product.OPENCLAW });
      const button = screen.getByRole('button', { name: /Deleting/i });
      fireEvent.click(button);
      expect(mockHandleDeleteButtonClick).not.toHaveBeenCalled();
    });

    it('shows Delete button for OpenClaw in READY status', () => {
      mockUseSandboxContext.mockReturnValue({
        ansibleStatus: AnsibleStatus.NEW,
        openclawStatus: OpenClawStatus.READY,
      } as any);
      renderButton({ id: Product.OPENCLAW });
      const button = screen.getByRole('button', { name: /Delete/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('shows Delete button for OpenClaw in IDLED status', () => {
      mockUseSandboxContext.mockReturnValue({
        ansibleStatus: AnsibleStatus.NEW,
        openclawStatus: OpenClawStatus.IDLED,
      } as any);
      renderButton({ id: Product.OPENCLAW });
      const button = screen.getByRole('button', { name: /Delete/i });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('does not render for OpenClaw in NEW status', () => {
      mockUseSandboxContext.mockReturnValue({
        ansibleStatus: AnsibleStatus.NEW,
        openclawStatus: OpenClawStatus.NEW,
      } as any);
      renderButton({ id: Product.OPENCLAW });
      expect(
        document.querySelector(`[data-testid="delete-${Product.OPENCLAW}"]`),
      ).toBeNull();
    });
  });
});
