import HybridLocationProvider from './HybridLocationProvider.js';
import LocalLocationProvider from './LocalLocationProvider.js';

const locationProvider = new HybridLocationProvider([
  new LocalLocationProvider()
]);

export const getLocationProvider = () => locationProvider;

export {
  HybridLocationProvider,
  LocalLocationProvider
};
