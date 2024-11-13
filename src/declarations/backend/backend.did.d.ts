import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Recommendation {
  'timestamp' : bigint,
  'recommendation' : string,
  'price' : number,
  'priceChange' : number,
}
export interface _SERVICE {
  'getRecommendationHistory' : ActorMethod<[], Array<Recommendation>>,
  'getTradeRecommendation' : ActorMethod<[number, number], string>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
