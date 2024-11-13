export const idlFactory = ({ IDL }) => {
  const Recommendation = IDL.Record({
    'timestamp' : IDL.Int,
    'recommendation' : IDL.Text,
    'price' : IDL.Float64,
    'priceChange' : IDL.Float64,
  });
  return IDL.Service({
    'getRecommendationHistory' : IDL.Func(
        [],
        [IDL.Vec(Recommendation)],
        ['query'],
      ),
    'getTradeRecommendation' : IDL.Func(
        [IDL.Float64, IDL.Float64],
        [IDL.Text],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
