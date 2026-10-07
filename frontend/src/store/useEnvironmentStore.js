// The place around the turbine: weather at the site and any demo override, as the server
// last reported it (see server/services/environmentService.js). Fed by realtime/liveSocket.js.

import { create } from "zustand";

export const useEnvironmentStore = create((set) => ({
  environment: null,
  setEnvironment: (environment) => set({ environment }),
}));
