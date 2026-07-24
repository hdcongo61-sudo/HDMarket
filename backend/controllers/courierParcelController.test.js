import { describe, expect, it } from 'vitest';
import {
  getOpenParcelPoolFilter,
  redactClaimableParcelAssignment
} from './courierParcelController.js';

describe('courier parcel pool', () => {
  it('selects only unassigned pending parcel requests', () => {
    const now = new Date('2026-07-24T12:00:00.000Z');
    const filter = getOpenParcelPoolFilter(now);

    expect(filter).toMatchObject({
      assignedDeliveryGuyId: null,
      status: 'PENDING',
      assignmentStatus: 'PENDING',
      currentStage: 'ASSIGNED'
    });
    expect(filter.$or).toContainEqual({ expiresAt: { $gt: now } });
  });

  it('hides private pickup information until a courier claims the parcel', () => {
    const item = redactClaimableParcelAssignment({
      _id: 'parcel-1',
      deliveryPinCodeHash: 'secret-hash',
      pickup: {
        cityName: 'Brazzaville',
        communeName: 'Poto-Poto',
        address: '12 rue privée',
        contactName: 'Expéditeur',
        contactPhone: '+242000000000',
        coordinates: { type: 'Point', coordinates: [15.2, -4.2] }
      },
      dropoff: {
        communeName: 'Bacongo',
        address: '34 rue privée'
      },
      authorization: {
        proofImageUrl: 'uploads/private-proof.jpg',
        referenceCode: 'REF-SECRET',
        notes: 'Informations privées'
      },
      requesterId: {
        _id: 'user-1',
        name: 'Client réel',
        phone: '+242111111111'
      }
    });

    expect(item.claimable).toBe(true);
    expect(item.pickup).toMatchObject({
      cityName: 'Brazzaville',
      communeName: 'Poto-Poto',
      address: '',
      contactName: '',
      contactPhone: '',
      coordinates: null
    });
    expect(item.dropoff.address).toBe('');
    expect(item.authorization).toEqual({
      proofImageUrl: '',
      referenceCode: '',
      notes: ''
    });
    expect(item.requesterId).toEqual({
      _id: 'user-1',
      name: 'Client HDMarket',
      phone: ''
    });
  });
});
