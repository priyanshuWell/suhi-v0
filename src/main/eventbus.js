import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();

export const EVENTS = {
  HEIGHT_STATUS: 'height:status',
  HEIGHT_ERROR: 'height:error',

  WEIGHT_STATUS: 'weight:status',
  WEIGHT_ERROR: 'weight:error',

  IMPEDANCE_STATUS: 'impedance:status',
  IMPEDANCE_ERROR: 'impedance:error'
};