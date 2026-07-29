export default class LocationProvider {
  async resolve() {
    throw new Error('LocationProvider.resolve() must be implemented.');
  }

  async reverseGeocode() {
    return null;
  }
}
