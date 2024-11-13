import { backend } from "declarations/backend";

let priceChart;
let currentCoin = 'ICP';
let updateCount = 0;
let lastSuccessfulData = {
    'ICP': null,
    'BTC': null
};

// Cache implementation
const cache = {
    data: {},
    timestamp: {},
    ttl: 10000, // 10 seconds cache

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
            const response = await fetch(url);
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
    
    if (cachedData) {
        return cachedData;
    }

    try {
        const data = await fetchWithRetry(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
        );

        if (!data[coinId]) {
            throw new Error('Invalid API response format');
        }

        const result = {
            price: data[coinId].usd,
            change24h: data[coinId].usd_24h_change
        };

        cache.set(cacheKey, result);
        lastSuccessfulData[coin] = result;
        return result;
    } catch (error) {
        console.error(`Error fetching ${coin} price:`, error);
        return lastSuccessfulData[coin] || getFallbackData(coin);
    }
}

function getFallbackData(coin) {
    // Fallback data when API fails
    return {
        price: coin === 'ICP' ? 5.50 : 35000.00,
        change24h: 0.00
    };
}

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

async function updateCoinData(coin) {
    const loading = document.getElementById(`loading${coin}`);
    const priceElement = document.getElementById(`currentPrice${coin}`);
    const recommendationElement = document.getElementById(`recommendation${coin}`);
    
    loading.classList.remove('d-none');

    try {
        const priceData = await fetchCryptoPrice(coin);
        const recommendation = await backend.getTradeRecommendation(coin, priceData.price, priceData.change24h);
        
        priceElement.textContent = `$${priceData.price.toFixed(2)} (${priceData.change24h.toFixed(2)}%)`;
        priceElement.className = priceData === lastSuccessfulData[coin] ? '' : 'text-warning';
        
        recommendationElement.textContent = recommendation;
        recommendationElement.className = `recommendation-text ${recommendation.includes('BUY') ? 'buy-signal' : 'wait-signal'}`;
    } catch (error) {
        console.error(`Error updating ${coin} data:`, error);
        priceElement.textContent = 'Temporarily unavailable';
        priceElement.className = 'text-danger';
        recommendationElement.textContent = 'Unable to generate recommendation';
        recommendationElement.className = 'recommendation-text text-danger';
    } finally {
        loading.classList.add('d-none');
    }
}

async function updateChart(coin) {
    const coinId = coin === 'ICP' ? 'internet-computer' : 'bitcoin';
    const cacheKey = `chart_${coinId}`;
    let chartData = cache.get(cacheKey);

    if (!chartData) {
        try {
            const response = await fetchWithRetry(
                `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30&interval=daily`
            );
            chartData = response.prices.map(price => ({
                x: new Date(price[0]),
                y: price[1]
            }));
            cache.set(cacheKey, chartData);
        } catch (error) {
            console.error('Error fetching chart data:', error);
            chartData = generateFallbackChartData(coin);
        }
    }

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
                }
            }
        }
    });
}

function generateFallbackChartData(coin) {
    const basePrice = coin === 'ICP' ? 5.50 : 35000.00;
    const data = [];
    const now = Date.now();
    for (let i = 30; i >= 0; i--) {
        data.push({
            x: new Date(now - i * 24 * 60 * 60 * 1000),
            y: basePrice + (Math.random() - 0.5) * basePrice * 0.1
        });
    }
    return data;
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

// Initial update
updateUI();

// Update every 15 seconds to avoid rate limiting
setInterval(updateUI, 15000);
