import Func "mo:base/Func";
import Text "mo:base/Text";

import Float "mo:base/Float";
import Int "mo:base/Int";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Time "mo:base/Time";
import Debug "mo:base/Debug";

actor {
    // Define the recommendation record type
    type Recommendation = {
        timestamp: Int;
        price: Float;
        priceChange: Float;
        recommendation: Text;
    };

    // Store historical recommendations
    private let history = Buffer.Buffer<Recommendation>(0);
    private let maxHistorySize = 100;

    // Technical analysis parameters
    private let buyThreshold : Float = -5.0; // Buy if price drops more than 5%
    private let strongBuyThreshold : Float = -10.0; // Strong buy if price drops more than 10%

    // Function to generate trade recommendations
    public func getTradeRecommendation(currentPrice: Float, priceChange24h: Float) : async Text {
        var recommendation = "WAIT - Market conditions not favorable";

        if (priceChange24h < strongBuyThreshold) {
            recommendation := "STRONG BUY - Significant price drop detected";
        } else if (priceChange24h < buyThreshold) {
            recommendation := "BUY - Price showing weakness";
        };

        // Add to history
        let newRecommendation : Recommendation = {
            timestamp = Time.now();
            price = currentPrice;
            priceChange = priceChange24h;
            recommendation = recommendation;
        };

        if (history.size() >= maxHistorySize) {
            ignore history.removeLast();
        };
        history.add(newRecommendation);

        return recommendation;
    };

    // Function to get recommendation history
    public query func getRecommendationHistory() : async [Recommendation] {
        Buffer.toArray(history)
    };

    // System functions for upgrades
    stable var stableHistory : [Recommendation] = [];

    system func preupgrade() {
        stableHistory := Buffer.toArray(history);
    };

    system func postupgrade() {
        for (recommendation in stableHistory.vals()) {
            history.add(recommendation);
        };
    };
}
