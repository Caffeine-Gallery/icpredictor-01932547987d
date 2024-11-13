import Func "mo:base/Func";

import Float "mo:base/Float";
import Int "mo:base/Int";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Time "mo:base/Time";
import Debug "mo:base/Debug";
import Text "mo:base/Text";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";

actor {
    // Define the recommendation record type
    type Recommendation = {
        timestamp: Int;
        price: Float;
        priceChange: Float;
        recommendation: Text;
    };

    // Store historical recommendations for each coin
    private let icpHistory = Buffer.Buffer<Recommendation>(0);
    private let btcHistory = Buffer.Buffer<Recommendation>(0);
    private let maxHistorySize = 100;

    // Technical analysis parameters
    private let thresholds = HashMap.HashMap<Text, (Float, Float)>(2, Text.equal, Text.hash);
    
    // Initialize thresholds for each coin
    private func initThresholds() {
        thresholds.put("ICP", (-5.0, -10.0)); // (buyThreshold, strongBuyThreshold)
        thresholds.put("BTC", (-3.0, -7.0));  // Bitcoin is typically less volatile
    };
    initThresholds();

    // Function to get the appropriate history buffer
    private func getHistoryBuffer(coin: Text) : Buffer.Buffer<Recommendation> {
        switch(coin) {
            case "BTC" { btcHistory };
            case _ { icpHistory };
        };
    };

    // Function to generate trade recommendations
    public func getTradeRecommendation(coin: Text, currentPrice: Float, priceChange24h: Float) : async Text {
        var recommendation = "WAIT - Market conditions not favorable";

        switch(thresholds.get(coin)) {
            case (?thresholdValues) {
                let (buyThreshold, strongBuyThreshold) = thresholdValues;
                
                if (priceChange24h < strongBuyThreshold) {
                    recommendation := "STRONG BUY - Significant price drop detected";
                } else if (priceChange24h < buyThreshold) {
                    recommendation := "BUY - Price showing weakness";
                };
            };
            case null {
                recommendation := "ERROR - Invalid coin specified";
            };
        };

        // Add to history
        let newRecommendation : Recommendation = {
            timestamp = Time.now();
            price = currentPrice;
            priceChange = priceChange24h;
            recommendation = recommendation;
        };

        let history = getHistoryBuffer(coin);
        if (history.size() >= maxHistorySize) {
            ignore history.removeLast();
        };
        history.add(newRecommendation);

        return recommendation;
    };

    // Function to get recommendation history
    public query func getRecommendationHistory(coin: Text) : async [Recommendation] {
        Buffer.toArray(getHistoryBuffer(coin))
    };

    // System functions for upgrades
    stable var stableICPHistory : [Recommendation] = [];
    stable var stableBTCHistory : [Recommendation] = [];

    system func preupgrade() {
        stableICPHistory := Buffer.toArray(icpHistory);
        stableBTCHistory := Buffer.toArray(btcHistory);
    };

    system func postupgrade() {
        for (recommendation in stableICPHistory.vals()) {
            icpHistory.add(recommendation);
        };
        for (recommendation in stableBTCHistory.vals()) {
            btcHistory.add(recommendation);
        };
    };
}
