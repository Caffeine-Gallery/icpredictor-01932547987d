import { backend } from "declarations/backend";

let priceChart;
let currentCoin = 'ICP';
let updateCount = 0;
let lastSuccessfulData = {
    'ICP': null,
    'BTC': null
};

const cache = {
    data: {},
    timestamp: {},
    ttl: 5000, // Reduced to 5 seconds

    set(key, value) {
        this.data[key] = value;
        this.timestamp[key] = Date.now();
    },

    get(key) {
        const timestamp = this.timestamp[key];
        if (timestamp && Date.now() - timestamp < this.ttl) {
            return this.data[key];
        }
        return null;
    }
};

async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
    }
}

async function fetchCryptoPrice(coin) {
    const coinId = coin === 'ICP' ? 'internet-computer' : 'bitcoin';
    const cacheKey = `price_${coinId}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData && cachedData.isReal) {
        return cachedData;
    }

    try {
        const data = await fetchWithRetry(
            `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
        );

        if (!data.market_data || typeof data.market_data.current_price.usd !== 'number') {
            throw new Error('Invalid API response format');
        }

        const result = {
            price: data.market_data.current_price.usd,
            change24h: data.market_data.price_change_percentage_24h,
            isReal: true,
            lastUpdated: data.market_data.last_updated
        };

        cache.set(cacheKey, result);
        lastSuccessfulData[coin] = result;
        return result;
    } catch (error) {
        console.error(`Error fetching ${coin} price:`, error);
        return lastSuccessfulData[coin] || {
            price: 0,
            change24h: 0,
            isReal: false,
            lastUpdated: null
        };
    }
}

async function updateCoinData(coin) {
    const loading = document.getElementById(`loading${coin}`);
    const priceElement = document.getElementById(`currentPrice${coin}`);
    const recommendationElement = document.getElementById(`recommendation${coin}`);
    
    loading.classList.remove('d-none');

    try {
        const priceData = await fetchCryptoPrice(coin);
        const recommendation = await backend.getTradeRecommendation(coin, priceData.price, priceData.change24h);
        
        if (!priceData.isReal) {
            throw new Error('Unable to fetch real-time data');
        }

        const formattedPrice = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(priceData.price);

        const formattedChange = new Intl.NumberFormat('en-US', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            signDisplay: 'always'
        }).format(priceData.change24h);

        priceElement.innerHTML = `
            ${formattedPrice} <span class="${priceData.change24h >= 0 ? 'price-up' : 'price-down'}">
                (${formattedChange}%)
            </span>
            <small class="d-block text-muted">
                Last Updated: ${new Date(priceData.lastUpdated).toLocaleTimeString()}
            </small>
        `;
        
        recommendationElement.textContent = recommendation;
        recommendationElement.className = `recommendation-text ${recommendation.includes('BUY') ? 'buy-signal' : 'wait-signal'}`;
    } catch (error) {
        console.error(`Error updating ${coin} data:`, error);
        priceElement.innerHTML = `
            <span class="text-danger">Price data unavailable</span>
            <small class="d-block text-muted">Please try again later</small>
        `;
        recommendationElement.textContent = 'Unable to generate recommendation';
        recommendationElement.className = 'recommendation-text text-danger';
    } finally {
        loading.classList.add('d-none');
    }
}

async function updateChart(coin) {
    const coinId = coin === 'ICP' ? 'internet-computer' : 'bitcoin';
    try {
        const response = await fetchWithRetry(
            `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30&interval=daily`
        );

        if (!response.prices || !Array.isArray(response.prices)) {
            throw new Error('Invalid chart data format');
        }

        const chartData = response.prices.map(price => ({
            x: new Date(price[0]),
            y: price[1]
        }));

        if (priceChart) {
            priceChart.destroy();
        }

        const ctx = document.getElementById('priceChart').getContext('2d');
        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: `${coin} Price (USD)`,
                    data: chartData,
                    borderColor: coin === 'ICP' ? 'rgb(75, 192, 192)' : 'rgb(247, 147, 26)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    },
                    y: {
                        ticks: {
                            callback: function(value) {
                                return new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    minimumFractionDigits: 2
                                }).format(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    minimumFractionDigits: 2
                                }).format(context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating chart:', error);
        document.getElementById('priceChart').innerHTML = `
            <div class="text-center text-danger p-3">
                Chart data temporarily unavailable
            </div>
        `;
    }
}

// Event Listeners
document.getElementById('chartBtnICP').addEventListener('click', function() {
    currentCoin = 'ICP';
    updateChart('ICP');
    this.classList.add('active');
    document.getElementById('chartBtnBTC').classList.remove('active');
});

document.getElementById('chartBtnBTC').addEventListener('click', function() {
    currentCoin = 'BTC';
    updateChart('BTC');
    this.classList.add('active');
    document.getElementById('chartBtnICP').classList.remove('active');
});

document.getElementById('historyBtnICP').addEventListener('click', function() {
    updateHistory('ICP');
    this.classList.add('active');
    document.getElementById('historyBtnBTC').classList.remove('active');
});

document.getElementById('historyBtnBTC').addEventListener('click', function() {
    updateHistory('BTC');
    this.classList.add('active');
    document.getElementById('historyBtnICP').classList.remove('active');
});

async function updateUI() {
    try {
        await Promise.all([updateCoinData('ICP'), updateCoinData('BTC')]);
        await updateChart(currentCoin);
        await updateHistory(currentCoin);
        
        updateCount++;
        document.getElementById('updateCounter').textContent = updateCount;
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
        
        const updateInfo = document.querySelector('.update-info');
        updateInfo.classList.add('flash');
        setTimeout(() => updateInfo.classList.remove('flash'), 500);
    } catch (error) {
        console.error('Error in updateUI:', error);
    }
}

// Initial update
updateUI();

// Update every 15 seconds
setInterval(updateUI, 15000);
