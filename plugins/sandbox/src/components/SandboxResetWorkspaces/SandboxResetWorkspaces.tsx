import React from 'react';
import { SandboxProvider } from '../../hooks/useSandboxContext';
import SandboxResetLink from './SandboxResetWorkspacesLink';

/**
 * Defines the component that shows the menu link for the "reset workspaces"
 * feature which opens a confirmation modal for it. It is wrapped in the
 * provider component to be able to access some common variables and user
 * data, to avoid repetition.
 */
const SandboxResetWorkspaces = () => {
  return (
    <SandboxProvider>
      <SandboxResetLink />
    </SandboxProvider>
  );
};

export default SandboxResetWorkspaces;
